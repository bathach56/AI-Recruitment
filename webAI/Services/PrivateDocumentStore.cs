using System.IO.Compression;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using webAI.Data;

namespace webAI.Services;

public class PrivateDocumentStore(RecruitmentDbContext db, IConfiguration? configuration = null)
{
    public async Task<byte[]?> ReadAsync(string key, CancellationToken ct = default) =>
        await db.Documents.AsNoTracking().Where(d => d.StorageKey == key).Select(d => d.Data).SingleOrDefaultAsync(ct);

    public Task RemoveAsync(string key) => db.Documents.Where(d => d.StorageKey == key).ExecuteDeleteAsync();

    public async Task<string> SaveAsync(IFormFile file, bool business = false)
    {
        if (file.Length is <= 0 or > 10485760) throw new ArgumentException("Tệp phải có nội dung và không vượt quá 10 MiB.");
        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        var allowed = business ? new[] { ".pdf", ".jpg", ".jpeg", ".png" } : new[] { ".pdf", ".docx" };
        if (!allowed.Contains(ext)) throw new ArgumentException("Định dạng tệp không được hỗ trợ.");
        using var data = new MemoryStream();
        await using (var source = file.OpenReadStream()) {
            var buffer = new byte[81920];
            int read;
            while ((read = await source.ReadAsync(buffer)) > 0) {
                if (data.Length + read > 10485760) throw new ArgumentException("Tệp vượt quá 10 MiB.");
                await data.WriteAsync(buffer.AsMemory(0, read));
            }
        }
        var bytes = data.ToArray();
        if (bytes.LongLength != file.Length || bytes.Length > 10485760)
            throw new ArgumentException("Kích thước thực tế của tệp không hợp lệ.");
        bool valid = ext switch {
            ".pdf" => bytes.AsSpan().StartsWith("%PDF-"u8) && Encoding.ASCII.GetString(bytes.AsSpan(Math.Max(0, bytes.Length - 1024))).Contains("%%EOF"),
            ".png" => bytes.AsSpan().StartsWith(new byte[] {137,80,78,71,13,10,26,10}),
            ".jpg" or ".jpeg" => bytes.Length > 3 && bytes[0] == 255 && bytes[1] == 216 && bytes[2] == 255,
            ".docx" => IsDocx(data),
            _ => false
        };
        if (!valid) throw new ArgumentException("Nội dung tệp không khớp định dạng hoặc tệp bị hỏng.");
        var key = Guid.NewGuid().ToString("N") + ext;
        // One database-wide budget also bounds uploads from newly registered accounts.
        // Keep the lock until the caller's batch commits, when a transaction already exists.
        var ownedTransaction = db.Database.CurrentTransaction == null ? await db.Database.BeginTransactionAsync() : null;
        await using var transactionLifetime = ownedTransaction;
        using var command = db.Database.GetDbConnection().CreateCommand();
        command.Transaction = db.Database.CurrentTransaction!.GetDbTransaction();
        command.CommandText = """
            DECLARE @result int;
            EXEC @result = sys.sp_getapplock @Resource=N'AIRecruitment.DocumentBudget',
                @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=5000;
            IF @result < 0 SELECT CAST(-1 AS bigint), CAST(-1 AS bigint);
            ELSE SELECT COUNT_BIG(*), COALESCE(SUM(CAST(DATALENGTH([Data]) AS bigint)),0) FROM [Documents];
            """;
        long count, used;
        await using (var reader = await command.ExecuteReaderAsync()) {
            await reader.ReadAsync(); count = reader.GetInt64(0); used = reader.GetInt64(1);
        }
        var maxBytes = configuration?.GetValue<long?>("DocumentStorage:MaxTotalBytes") ?? 1024L * 1024 * 1024;
        var maxCount = configuration?.GetValue<long?>("DocumentStorage:MaxDocuments") ?? 10000;
        if (count < 0) throw new ArgumentException("Hệ thống đang bận nhận tệp. Vui lòng thử lại sau.");
        if (maxBytes <= 0 || maxCount <= 0 || count >= maxCount || used > maxBytes - bytes.LongLength)
            throw new ArgumentException("Kho tài liệu đã đạt giới hạn an toàn. Vui lòng liên hệ quản trị viên.");
        var document = new StoredDocument { StorageKey = key, Data = bytes,
            Sha256 = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(bytes)) };
        db.Documents.Add(document);
        try {
            await db.SaveChangesAsync();
            if (ownedTransaction != null) await ownedTransaction.CommitAsync();
        } catch { db.Entry(document).State = EntityState.Detached; throw; }
        return key;
    }

    private static bool IsDocx(MemoryStream data)
    {
        try {
            data.Position = 0;
            using var zip = new ZipArchive(data, ZipArchiveMode.Read, leaveOpen: true);
            if (zip.Entries.Count > 2000 || zip.Entries.Sum(x => x.Length) > 50L * 1024 * 1024) return false;
            var entry = zip.GetEntry("word/document.xml");
            if (entry == null || zip.GetEntry("[Content_Types].xml") == null) return false;
            using var stream = entry.Open();
            using var reader = System.Xml.XmlReader.Create(stream, new System.Xml.XmlReaderSettings { DtdProcessing = System.Xml.DtdProcessing.Prohibit, XmlResolver = null, MaxCharactersInDocument = 50L * 1024 * 1024 });
            while (reader.Read()) { if (reader.Depth > DocxPreviewText.MaxDepth) return false; }
            return true;
        }
        catch (Exception ex) when (ex is InvalidDataException or System.Xml.XmlException) { return false; }
    }
}

using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;

namespace webAI.Data;

// The existing database uses additive upgrades rather than EF migrations.
public static class DocumentStorageSetup
{
    public static Task InitializeAsync(RecruitmentDbContext db) => db.Database.ExecuteSqlRawAsync("""
        IF OBJECT_ID(N'[dbo].[Documents]', N'U') IS NULL
        CREATE TABLE [dbo].[Documents] (
            [StorageKey] nvarchar(80) NOT NULL PRIMARY KEY,
            [Data] varbinary(max) NOT NULL,
            [Sha256] nvarchar(64) NOT NULL,
            [CreatedAt] datetimeoffset NOT NULL);
        """);

    public static async Task<string> BackupAsync(RecruitmentDbContext db, string contentRoot)
    {
        var folder = Path.Combine(contentRoot, "App_Data", "backups", "sql-" + DateTime.UtcNow.ToString("yyyyMMdd-HHmmss") + "-" + Guid.NewGuid().ToString("N")[..6]);
        Directory.CreateDirectory(folder);
        var path = Path.Combine(folder, "AIRecruitmentDb.bak");
        var connection = db.Database.GetDbConnection();
        await db.Database.OpenConnectionAsync();
        try {
            await using var command = connection.CreateCommand(); command.CommandTimeout = 180;
            var database = connection.Database.Replace("]", "]]");
            command.CommandText = $"BACKUP DATABASE [{database}] TO DISK=@path WITH COPY_ONLY,CHECKSUM; RESTORE VERIFYONLY FROM DISK=@path WITH CHECKSUM;";
            var parameter = command.CreateParameter(); parameter.ParameterName = "@path"; parameter.Value = path; command.Parameters.Add(parameter);
            await command.ExecuteNonQueryAsync();
        } finally { await db.Database.CloseConnectionAsync(); }
        Console.WriteLine("Bản sao SQL đã được kiểm tra: " + path);
        return path;
    }

    public static async Task ImportLegacyAsync(RecruitmentDbContext db, string contentRoot)
    {
        await BackupAsync(db, contentRoot);
        await InitializeAsync(db);
        var keys = await db.Resumes.Select(r => r.StorageKey).ToListAsync();
        keys.AddRange(await db.Verifications.Select(v => v.DocumentStorageKey).ToListAsync());
        keys.AddRange(await db.CvReviewItems.Where(i => i.StorageKey != "").Select(i => i.StorageKey).ToListAsync());
        var folder = Path.Combine(contentRoot, "App_Data", "documents");
        // Import unreferenced historical files too; never delete the originals.
        if (Directory.Exists(folder)) keys.AddRange(Directory.EnumerateFiles(folder).Select(Path.GetFileName).OfType<string>());
        var added = 0;
        await using var transaction = await db.Database.BeginTransactionAsync();
        foreach (var key in keys.Where(k => !string.IsNullOrWhiteSpace(k)).Distinct()) {
            if (key.Length > 80 || Path.GetFileName(key) != key || key.Contains('\\') || key.Contains('/'))
                throw new InvalidDataException("Khóa tài liệu không hợp lệ: " + key);
            var existing = await db.Documents.AsNoTracking().SingleOrDefaultAsync(d => d.StorageKey == key);
            var path = Path.Combine(folder, key);
            if (!File.Exists(path)) {
                if (existing != null) continue;
                throw new FileNotFoundException("Thiếu tài liệu cũ; đã dừng, chưa chuyển dữ liệu.", path);
            }
            var bytes = await File.ReadAllBytesAsync(path);
            var hash = Convert.ToHexString(SHA256.HashData(bytes));
            if (existing != null) {
                if (existing.Sha256 != hash || !existing.Data.AsSpan().SequenceEqual(bytes))
                    throw new InvalidDataException("Tài liệu SQL và bản cũ khác nhau: " + key);
                continue;
            }
            db.Documents.Add(new StoredDocument { StorageKey = key, Data = bytes, Sha256 = hash });
            await db.SaveChangesAsync();
            var saved = await db.Documents.AsNoTracking().SingleAsync(d => d.StorageKey == key);
            if (!saved.Data.AsSpan().SequenceEqual(bytes)) throw new InvalidDataException("Kiểm tra tài liệu sau ghi thất bại.");
            db.ChangeTracker.Clear(); added++;
        }
        await transaction.CommitAsync();
        Console.WriteLine($"Đã chuyển {added} tài liệu vào SQL và kiểm tra nội dung. Bản tệp cũ được giữ nguyên.");
    }
}

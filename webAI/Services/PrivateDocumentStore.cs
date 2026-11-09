using System.IO.Compression;
using System.Text;

namespace webAI.Services;

public class PrivateDocumentStore(IWebHostEnvironment environment)
{
    public string PathFor(string key) => Path.Combine(environment.ContentRootPath, "App_Data", "documents", key);

    public async Task<string> SaveAsync(IFormFile file, bool business = false)
    {
        if (file.Length is <= 0 or > 10485760) throw new ArgumentException("Tệp phải có nội dung và không vượt quá 10 MiB.");
        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        var allowed = business ? new[] { ".pdf", ".jpg", ".jpeg", ".png" } : new[] { ".pdf", ".docx" };
        if (!allowed.Contains(ext)) throw new ArgumentException("Định dạng tệp không được hỗ trợ.");
        using var data = new MemoryStream();
        await file.CopyToAsync(data);
        var bytes = data.ToArray();
        bool valid = ext switch {
            ".pdf" => bytes.AsSpan().StartsWith("%PDF-"u8) && Encoding.ASCII.GetString(bytes.AsSpan(Math.Max(0, bytes.Length - 1024))).Contains("%%EOF"),
            ".png" => bytes.AsSpan().StartsWith(new byte[] {137,80,78,71,13,10,26,10}),
            ".jpg" or ".jpeg" => bytes.Length > 3 && bytes[0] == 255 && bytes[1] == 216 && bytes[2] == 255,
            ".docx" => IsDocx(data),
            _ => false
        };
        if (!valid) throw new ArgumentException("Nội dung tệp không khớp định dạng hoặc tệp bị hỏng.");
        var key = Guid.NewGuid().ToString("N") + ext;
        Directory.CreateDirectory(Path.GetDirectoryName(PathFor(key))!);
        await File.WriteAllBytesAsync(PathFor(key), bytes);
        return key;
    }

    private static bool IsDocx(MemoryStream data)
    {
        try {
            data.Position = 0;
            using var zip = new ZipArchive(data, ZipArchiveMode.Read, leaveOpen: true);
            if (zip.Entries.Sum(x => x.Length) > 50 * 1024 * 1024) return false;
            var entry = zip.GetEntry("word/document.xml");
            if (entry == null || zip.GetEntry("[Content_Types].xml") == null) return false;
            using var stream = entry.Open();
            using var reader = System.Xml.XmlReader.Create(stream, new System.Xml.XmlReaderSettings { DtdProcessing = System.Xml.DtdProcessing.Prohibit, XmlResolver = null });
            while (reader.Read()) { }
            return true;
        }
        catch (Exception ex) when (ex is InvalidDataException or System.Xml.XmlException) { return false; }
    }
}

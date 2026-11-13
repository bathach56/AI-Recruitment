using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace webAI.Data;

public static class RecoveryVerification
{
    public static async Task RunAsync(RecruitmentDbContext source, string contentRoot)
    {
        var backup = await DocumentStorageSetup.BackupAsync(source, contentRoot);
        var folder = Path.Combine(Path.GetDirectoryName(backup)!, "recovered"); Directory.CreateDirectory(folder);
        var target = "AIRecruitmentRecovery_" + Guid.NewGuid().ToString("N")[..12];
        var builder = new SqlConnectionStringBuilder(source.Database.GetConnectionString()) { InitialCatalog = "master" };
        await using var connection = new SqlConnection(builder.ConnectionString); await connection.OpenAsync();
        var files = new List<(string Logical, string Physical)>();
        await using (var command = connection.CreateCommand()) {
            command.CommandText = "RESTORE FILELISTONLY FROM DISK=@path"; command.Parameters.AddWithValue("@path", backup);
            await using var reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync()) {
                var type = reader.GetString(reader.GetOrdinal("Type"));
                if (type is not ("D" or "L")) throw new InvalidDataException("Loại tệp SQL chưa được hỗ trợ; dừng khôi phục tự động.");
                files.Add((reader.GetString(reader.GetOrdinal("LogicalName")), Path.Combine(folder, target + "_" + files.Count + (type == "L" ? ".ldf" : ".mdf"))));
            }
        }
        await using (var command = connection.CreateCommand()) {
            command.CommandTimeout = 180;
            command.CommandText = $"IF DB_ID(N'{target}') IS NOT NULL THROW 50000,'Recovery database already exists',1; RESTORE DATABASE [{target}] FROM DISK=@backup WITH RECOVERY," +
                string.Join(",", files.Select((_, index) => $"MOVE @logical{index} TO @physical{index}"));
            command.Parameters.AddWithValue("@backup", backup);
            for (var i = 0; i < files.Count; i++) { command.Parameters.AddWithValue("@logical" + i, files[i].Logical); command.Parameters.AddWithValue("@physical" + i, files[i].Physical); }
            await command.ExecuteNonQueryAsync();
        }
        await using (var command = connection.CreateCommand()) {
            command.CommandTimeout = 180; command.CommandText = $"DBCC CHECKDB ([{target}]) WITH NO_INFOMSGS, ALL_ERRORMSGS;";
            // CHECKDB returns rows for errors; do not turn them into a success.
            await using var reader = await command.ExecuteReaderAsync();
            do { if (await reader.ReadAsync()) throw new InvalidDataException("CHECKDB trả về lỗi cho bản khôi phục."); } while (await reader.NextResultAsync());
        }
        builder.InitialCatalog = target;
        await using var recovered = new RecruitmentDbContext(new DbContextOptionsBuilder<RecruitmentDbContext>().UseSqlServer(builder.ConnectionString).Options);
        var documents = await recovered.Documents.AsNoTracking().ToListAsync();
        foreach (var document in documents)
            if (Convert.ToHexString(SHA256.HashData(document.Data)) != document.Sha256) throw new InvalidDataException("SHA-256 tài liệu sau phục hồi không khớp: " + document.StorageKey);
        var missing = await recovered.Resumes.CountAsync(r => !recovered.Documents.Any(d => d.StorageKey == r.StorageKey));
        missing += await recovered.Verifications.CountAsync(v => !recovered.Documents.Any(d => d.StorageKey == v.DocumentStorageKey));
        missing += await recovered.CvReviewItems.CountAsync(i => i.StorageKey != "" && !recovered.Documents.Any(d => d.StorageKey == i.StorageKey));
        if (missing != 0) throw new InvalidDataException("Bản phục hồi có tham chiếu tài liệu bị thiếu.");
        var report = new {
            verifiedAt = DateTimeOffset.UtcNow, database = target, backup,
            integrity = "CHECKDB passed", documentHashesVerified = documents.Count, missingDocuments = missing,
            users = await recovered.Users.CountAsync(), jobs = await recovered.Jobs.CountAsync(), applications = await recovered.Applications.CountAsync(),
            reviews = await recovered.CvReviewBatches.CountAsync(), notifications = await recovered.Notifications.CountAsync(),
            note = "Khôi phục thực tế vào database mới trên cùng máy; chưa kiểm tra trên máy độc lập. Không ghi đè hoặc xóa database nguồn."
        };
        var output = Path.Combine(Path.GetDirectoryName(backup)!, "recovery-report.json");
        await File.WriteAllTextAsync(output, JsonSerializer.Serialize(report, new JsonSerializerOptions { WriteIndented = true }));
        Console.WriteLine($"Đã khôi phục {target}, CHECKDB đạt, kiểm tra {documents.Count} tài liệu SHA-256. Báo cáo: {output}");
    }
}

using Microsoft.EntityFrameworkCore;
using webAI.Services;

namespace webAI.Data;

public static class AccountSetup
{
    // Additive upgrade for the existing EnsureCreated database (no EF migrations exist).
    public static async Task InitializeAsync(RecruitmentDbContext db, AccountService accounts, IConfiguration config)
    {
        await db.Database.ExecuteSqlRawAsync("""
            IF OBJECT_ID(N'[dbo].[USERS]', N'U') IS NULL
            BEGIN
                CREATE TABLE [dbo].[USERS] (
                    [UserId] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    [Email] nvarchar(150) NOT NULL,
                    [PasswordHash] nvarchar(450) NOT NULL,
                    [RoleName] nvarchar(50) NOT NULL,
                    [IsActive] bit NOT NULL,
                    [CreatedAt] datetime2 NOT NULL,
                    [LastLoginAt] datetime2 NULL);
                CREATE UNIQUE INDEX [IX_USERS_Email] ON [dbo].[USERS] ([Email]);
            END
            """);
        foreach (var role in new[] { "Candidate", "Recruiter" })
        {
            var email = config[$"TestAccounts:{role}:Email"];
            var password = config[$"TestAccounts:{role}:Password"];
            if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password)) continue;
            if (password.Length < 8) throw new InvalidOperationException("Test password must contain at least eight characters.");
            await accounts.RegisterAsync(email, password, role == "Candidate" ? "Ứng viên thử nghiệm" : "Công ty thử nghiệm", role);
        }
        Console.WriteLine("Account schema ready. Configured accounts created if they did not already exist; existing passwords unchanged.");
    }
}

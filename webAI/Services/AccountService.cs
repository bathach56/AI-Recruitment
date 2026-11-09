using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using webAI.Data;
using webAI.Models.Entities;

namespace webAI.Services;

public class AccountService(RecruitmentDbContext db)
{
    private readonly PasswordHasher<User> hasher = new();
    public async Task<User?> AuthenticateAsync(string email, string password)
    {
        var user = await db.Users.SingleOrDefaultAsync(x => x.Email == Normalize(email));
        // Also hash on unknown addresses to avoid a cheap account enumeration timing signal.
        if (user == null) { hasher.HashPassword(new User(), password); return null; }
        if (!user.IsActive) return null;
        var result = hasher.VerifyHashedPassword(user, user.PasswordHash, password);
        if (result == PasswordVerificationResult.Failed) return null;
        if (result == PasswordVerificationResult.SuccessRehashNeeded)
            user.PasswordHash = hasher.HashPassword(user, password);
        user.LastLoginAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return user;
    }

    public async Task<User?> RegisterAsync(string email, string password, string name, string role)
    {
        email = Normalize(email);
        if (await db.Users.AnyAsync(x => x.Email == email)) return null;
        using var transaction = await db.Database.BeginTransactionAsync();
        var user = new User { Email = email, RoleName = role };
        user.PasswordHash = hasher.HashPassword(user, password);
        db.Users.Add(user);
        try { await db.SaveChangesAsync(); }
        catch (DbUpdateException ex) when (ex.InnerException is Microsoft.Data.SqlClient.SqlException { Number: 2601 or 2627 })
        { return null; }
        var subject = user.UserId.ToString();
        if (role == "Candidate") db.Candidates.Add(new CandidateProfile { Subject = subject, FullName = name.Trim(), Email = email });
        else db.Companies.Add(new Company { OwnerSubject = subject, Name = name.Trim(), Initials = name.Trim()[..1].ToUpperInvariant() });
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        return user;
    }

    public static string Normalize(string email) => email.Trim().ToLowerInvariant();
}

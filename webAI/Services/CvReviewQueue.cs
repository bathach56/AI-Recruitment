using Microsoft.EntityFrameworkCore;
using webAI.Data;

namespace webAI.Services;

public class CvReviewQueue(RecruitmentDbContext db)
{
    public async Task<bool> EnqueueAsync(Guid id, int companyId)
    {
        await using var transaction = db.Database.CurrentTransaction == null ? await db.Database.BeginTransactionAsync() : null;
        var batch = await db.CvReviewBatches.SingleOrDefaultAsync(b => b.Id == id && b.CompanyId == companyId);
        if (batch == null) return false;
        if (batch.QueueState is not ("Queued" or "Running")) {
            await db.CvReviewItems.Where(i => i.BatchId == id && i.State == "Error")
                .ExecuteUpdateAsync(s => s.SetProperty(i => i.State, "Queued").SetProperty(i => i.Error, ""));
            batch.QueueState = "Queued";
            await db.SaveChangesAsync();
        }
        if (transaction != null) await transaction.CommitAsync(); return true;
    }

    public async Task<bool> PauseAsync(Guid id, int companyId)
    {
        if (!await db.CvReviewBatches.AnyAsync(b => b.Id == id && b.CompanyId == companyId)) return false;
        await db.CvReviewBatches.Where(b => b.Id == id && b.CompanyId == companyId && (b.QueueState == "Queued" || b.QueueState == "Running"))
            .ExecuteUpdateAsync(s => s.SetProperty(b => b.QueueState, "Paused"));
        return true;
    }
}

// One sequential worker per web process. SQL owns pending work; closing a page
// does not cancel it. AnalyzeAsync atomically leases each item for five minutes.
public class CvReviewWorker(IServiceScopeFactory scopes, ILogger<CvReviewWorker> logger, IConfiguration config) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!config.GetValue("ReviewQueue:Enabled", true)) return;
        while (!stoppingToken.IsCancellationRequested) {
            try { await ProcessOneAsync(stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception ex) { logger.LogError(ex, "CV queue tick failed; pending work stays in SQL"); }
            try { await Task.Delay(TimeSpan.FromSeconds(2), stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
        }
    }

    public async Task ProcessOneAsync(CancellationToken ct)
    {
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<RecruitmentDbContext>();
        var expiry = DateTimeOffset.UtcNow.AddMinutes(-5);
        // A batch with a recent in-flight item must not block other companies.
        var batch = await db.CvReviewBatches.AsNoTracking()
            .Where(b => b.QueueState == "Queued" || b.QueueState == "Running")
            .Where(b => db.CvReviewItems.Any(i => i.BatchId == b.Id && (i.State == "Queued" || (i.State == "Running" && (i.AnalyzedAt == null || i.AnalyzedAt < expiry)))) ||
                !db.CvReviewItems.Any(i => i.BatchId == b.Id && i.State == "Running"))
            .OrderBy(b => b.CreatedAt).FirstOrDefaultAsync(ct);
        if (batch == null) return;
        if (await db.CvReviewBatches.Where(b => b.Id == batch.Id && (b.QueueState == "Queued" || b.QueueState == "Running"))
            .ExecuteUpdateAsync(s => s.SetProperty(b => b.QueueState, "Running"), ct) == 0) return;
        var item = await db.CvReviewItems.AsNoTracking().Where(i => i.BatchId == batch.Id &&
            (i.State == "Queued" || (i.State == "Running" && (i.AnalyzedAt == null || i.AnalyzedAt < expiry))))
            .OrderBy(i => i.Id).FirstOrDefaultAsync(ct);
        if (item == null) {
            if (!await db.CvReviewItems.AnyAsync(i => i.BatchId == batch.Id && (i.State == "Running" || i.State == "Queued"), ct))
                await db.CvReviewBatches.Where(b => b.Id == batch.Id && b.QueueState == "Running")
                    .ExecuteUpdateAsync(s => s.SetProperty(b => b.QueueState, "Complete"), ct);
            return;
        }
        if (!await db.CvReviewBatches.AnyAsync(b => b.Id == batch.Id && b.QueueState == "Running", ct)) return;
        try {
            await scope.ServiceProvider.GetRequiredService<CvReviewService>().AnalyzeAsync(batch.Id, item.Id, batch.CompanyId, ct);
        } catch (InvalidOperationException ex) { logger.LogDebug(ex, "CV queue item lease is held by another caller"); return; }
        if (ct.IsCancellationRequested)
            await db.CvReviewItems.Where(i => i.Id == item.Id && i.State == "Error")
                .ExecuteUpdateAsync(s => s.SetProperty(i => i.State, "Queued"), CancellationToken.None);
    }
}

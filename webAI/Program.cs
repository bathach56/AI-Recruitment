using webAI.Services;
using webAI.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication;
using System.Security.Claims;

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.ConfigureKestrel(options => options.AddServerHeader = false);

// Add services to the container.
builder.Services.AddRazorPages(options =>
{
    options.Conventions.AuthorizePage("/Candidate", "Candidate");
    options.Conventions.AuthorizePage("/Recruiter", "Recruiter");
    options.Conventions.AuthorizePage("/Matching", "Recruiter");
    options.Conventions.AuthorizePage("/ReviewResults", "Recruiter");
    options.Conventions.AuthorizePage("/Results", "Candidate");
    options.Conventions.AuthorizePage("/Admin", "Admin");
});
builder.Services.AddAntiforgery(o => o.HeaderName = "X-CSRF-TOKEN");
builder.Services.AddScoped<AccountService>();
builder.Services.AddScoped<PrivateDocumentStore>();
builder.Services.AddScoped<CvReviewService>();
builder.Services.AddScoped<CvReviewQueue>();
builder.Services.AddHostedService<CvReviewWorker>();
builder.Services.AddRateLimiter(o => {
    o.RejectionStatusCode = 429;
    o.AddPolicy("account", context => System.Threading.RateLimiting.RateLimitPartition.GetFixedWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "local", _ => new System.Threading.RateLimiting.FixedWindowRateLimiterOptions {
            PermitLimit = 15, Window = TimeSpan.FromMinutes(1), QueueLimit = 0
        }));
});
builder.Services.AddControllers().ConfigureApiBehaviorOptions(options => {
    options.InvalidModelStateResponseFactory = context => new Microsoft.AspNetCore.Mvc.BadRequestObjectResult(new {
        message = "Dữ liệu chưa hợp lệ. Vui lòng kiểm tra các thông tin bắt buộc, định dạng và độ dài cho phép.",
        errors = context.ModelState.Where(x => x.Value?.Errors.Count > 0).ToDictionary(x => x.Key, _ => new[] { "Thông tin bị thiếu hoặc không đúng định dạng cho phép." })
    });
});
builder.Services.AddDbContext<RecruitmentDbContext>(options => options.UseSqlServer(
    builder.Configuration.GetConnectionString("Recruitment")
    ?? "Server=(localdb)\\MSSQLLocalDB;Database=AIRecruitmentDb;Integrated Security=true;TrustServerCertificate=true"));
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme).AddCookie(options =>
{
    options.LoginPath = "/Login";
    options.Cookie.HttpOnly = true;
    options.Cookie.SecurePolicy = builder.Environment.IsDevelopment() ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always;
    options.Cookie.SameSite = SameSiteMode.Lax;
    options.ExpireTimeSpan = TimeSpan.FromHours(8);
    options.Events.OnValidatePrincipal = async context => {
        var subject=context.Principal?.FindFirstValue(ClaimTypes.NameIdentifier);
        var role=context.Principal?.FindFirstValue(ClaimTypes.Role);var email=context.Principal?.Identity?.Name;
        var db=context.HttpContext.RequestServices.GetRequiredService<RecruitmentDbContext>();
        if(!int.TryParse(subject,out var id)||!await db.Users.AsNoTracking().AnyAsync(u=>u.UserId==id&&u.IsActive&&u.RoleName==role&&u.Email==email)){
            context.RejectPrincipal();await context.HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        }
    };
    options.Events.OnRedirectToLogin = context => {
        if (context.Request.Path.StartsWithSegments("/api")) context.Response.StatusCode = 401;
        else context.Response.Redirect(context.RedirectUri);
        return Task.CompletedTask;
    };
    options.Events.OnRedirectToAccessDenied = context => { context.Response.StatusCode = 403; return Task.CompletedTask; };
});
builder.Services.AddAuthorization(options => {
    foreach (var role in new[] { "Candidate", "Recruiter", "Admin" })
        options.AddPolicy(role, policy => policy.RequireRole(role));
});
builder.Services.AddHttpClient<IAiMatchingService, AiMatchingService>();

var app = builder.Build();

if (args.Contains("--migrate-documents") || args.Contains("--backup-database") || args.Contains("--verify-restore"))
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<RecruitmentDbContext>();
    if (args.Contains("--verify-restore")) await RecoveryVerification.RunAsync(db, app.Environment.ContentRootPath);
    else if (args.Contains("--migrate-documents")) await DocumentStorageSetup.ImportLegacyAsync(db, app.Environment.ContentRootPath);
    else await DocumentStorageSetup.BackupAsync(db, app.Environment.ContentRootPath);
    return;
}

if (args.Contains("--initialize-reviews"))
{
    using var scope = app.Services.CreateScope();
    await CvReviewSetup.InitializeAsync(scope.ServiceProvider.GetRequiredService<RecruitmentDbContext>());
    return;
}

if (args.Contains("--initialize-database"))
{
    using var scope = app.Services.CreateScope();
    await DatabaseSetup.InitializeAsync(scope.ServiceProvider.GetRequiredService<RecruitmentDbContext>());
    return;
}

if (args.Contains("--initialize-accounts"))
{
    using var scope = app.Services.CreateScope();
    await AccountSetup.InitializeAsync(scope.ServiceProvider.GetRequiredService<RecruitmentDbContext>(),
        scope.ServiceProvider.GetRequiredService<AccountService>(), builder.Configuration);
    return;
}

// New installations create the table through EnsureCreated; existing ones get
// this idempotent additive upgrade. Legacy file import is an explicit command.
using (var scope = app.Services.CreateScope()) {
    var db = scope.ServiceProvider.GetRequiredService<RecruitmentDbContext>();
    await DocumentStorageSetup.InitializeAsync(db);
    await CvReviewSetup.InitializeAsync(db);
}

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.Use(async (context, next) =>
{
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["X-Frame-Options"] = "SAMEORIGIN";
    context.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
    context.Response.Headers["Content-Security-Policy"] = "frame-ancestors 'self'; object-src 'none'; base-uri 'self'";
    if (context.Request.Path.StartsWithSegments("/api")) context.Response.Headers.CacheControl = "no-store";
    try { await next(); }
    catch (Exception ex) when (context.Request.Path.StartsWithSegments("/api") && !context.Response.HasStarted && ex is not OperationCanceledException)
    {
        app.Logger.LogError(ex, "API request failed: {Path}", context.Request.Path);
        context.Response.StatusCode = ex is Microsoft.Data.SqlClient.SqlException or DbUpdateException ? 503 : 500;
        await context.Response.WriteAsJsonAsync(new { message = "Không xử lý được yêu cầu. Vui lòng thử lại sau." });
    }
});
// Preserve old static bookmarks while keeping one canonical recruitment UI.
app.Use(async (context, next) =>
{
    var target = context.Request.Path.Value?.ToLowerInvariant() switch
    {
        "/index.html" => "/",
        "/candidate-portal.html" => "/Candidate",
        "/recruiter-dashboard.html" => "/Recruiter",
        "/login.html" => "/Login",
        "/register.html" => "/Register",
        "/admin-portal.html" => "/Admin",
        _ => null
    };
    if (target != null) { context.Response.Redirect(target + context.Request.QueryString); return; }
    await next();
});
app.UseStaticFiles();
app.UseWhen(context => !context.Request.Path.StartsWithSegments("/api"), branch =>
    branch.UseStatusCodePagesWithReExecute("/Status/{0}"));
app.UseRouting();
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

app.MapRazorPages();
app.MapControllers();

app.Run();

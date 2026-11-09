using webAI.Services;
using webAI.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.Cookies;

var builder = WebApplication.CreateBuilder(args);

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
builder.Services.AddRateLimiter(o => {
    o.RejectionStatusCode = 429;
    o.AddPolicy("account", context => System.Threading.RateLimiting.RateLimitPartition.GetFixedWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "local", _ => new System.Threading.RateLimiting.FixedWindowRateLimiterOptions {
            PermitLimit = 15, Window = TimeSpan.FromMinutes(1), QueueLimit = 0
        }));
});
builder.Services.AddControllers();
builder.Services.AddDbContext<RecruitmentDbContext>(options => options.UseSqlServer(
    builder.Configuration.GetConnectionString("Recruitment")
    ?? "Server=(localdb)\\MSSQLLocalDB;Database=AIRecruitmentDb;Integrated Security=true;TrustServerCertificate=true"));
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme).AddCookie(options =>
{
    options.LoginPath = "/Login";
    options.Cookie.HttpOnly = true;
    options.Cookie.SameSite = SameSiteMode.Lax;
    options.ExpireTimeSpan = TimeSpan.FromHours(8);
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

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.Use(async (context, next) =>
{
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

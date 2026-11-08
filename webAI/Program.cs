using Microsoft.AspNetCore.RateLimiting;
using webAI.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddRazorPages();
builder.Services.AddControllers();
builder.Services.AddSingleton<ICvAnalysisService, CvAnalysisService>();
builder.Services.AddHttpClient<IAiMatchingService, AiMatchingService>();

builder.Services.AddHttpClient<RecruitmentChatService>(client =>
{
    client.BaseAddress = new UriBuilder("http", "127.0.0.1", builder.Configuration.GetValue("Chat:Port", 11434)).Uri;
    client.Timeout = TimeSpan.FromSeconds(45);
    client.MaxResponseContentBufferSize = 128 * 1024;
}).ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler
{
    AllowAutoRedirect = false,
    UseProxy = false,
    MaxConnectionsPerServer = 2
}).RemoveAllLoggers();
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddFixedWindowLimiter("chat", limiter =>
    {
        limiter.PermitLimit = 12;
        limiter.Window = TimeSpan.FromMinutes(1);
    });
});

var app = builder.Build();

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseRouting();
app.UseRateLimiter();
app.UseAuthorization();

app.MapRazorPages();
app.MapControllers();

app.Run();

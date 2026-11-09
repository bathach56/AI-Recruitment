using System.Net;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using webAI.Controllers;
using webAI.Services;

static void Check(bool condition, string description)
{
    if (!condition) throw new InvalidOperationException(description);
    Console.WriteLine($"PASS: {description}");
}

var started = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
var waitForCancellation = true;
using var handler = new ProbeHandler(async ct =>
{
    if (waitForCancellation)
    {
        started.TrySetResult();
        await Task.Delay(Timeout.InfiniteTimeSpan, ct);
    }
    return new HttpResponseMessage(HttpStatusCode.OK);
});
using var http = new HttpClient(handler);
var configuration = new ConfigurationBuilder().Build();
var service = new AiMatchingService(http, NullLogger<AiMatchingService>.Instance, configuration);
var controller = new MatchingController(service, NullLogger<MatchingController>.Instance);
using var navigation = new CancellationTokenSource();
var pending = controller.GetHealth(navigation.Token);
await started.Task.WaitAsync(TimeSpan.FromSeconds(5));
navigation.Cancel();
var cancelled = await pending.WaitAsync(TimeSpan.FromSeconds(5));
Check(cancelled is EmptyResult, "Leaving page during health probe completes without exception or false outage");

waitForCancellation = false;
var next = await controller.GetHealth(CancellationToken.None);
Check(next is ObjectResult { StatusCode: 200 }, "Next page can check health after navigation cancellation");
using var alreadyCancelled = new CancellationTokenSource();
alreadyCancelled.Cancel();
Check(await controller.GetHealth(alreadyCancelled.Token) is EmptyResult,
    "Already-cancelled health request also completes without exception");

foreach (var status in new[] { HttpStatusCode.OK, HttpStatusCode.ServiceUnavailable })
{
    using var responseHandler = new ProbeHandler(_ => Task.FromResult(new HttpResponseMessage(status)));
    using var client = new HttpClient(responseHandler);
    var probe = new AiMatchingService(client, NullLogger<AiMatchingService>.Instance, configuration);
    var endpoint = new MatchingController(probe, NullLogger<MatchingController>.Instance);
    var expected = status == HttpStatusCode.OK ? 200 : 503;
    Check(await endpoint.GetHealth(CancellationToken.None) is ObjectResult result && result.StatusCode == expected,
        $"AI response {(int)status} still produces HTTP {expected}");
}

foreach (Exception failure in new Exception[] { new HttpRequestException("Connection refused"), new TaskCanceledException("Timeout") })
{
    using var failingHandler = new ProbeHandler(_ => Task.FromException<HttpResponseMessage>(failure));
    using var client = new HttpClient(failingHandler);
    var probe = new AiMatchingService(client, NullLogger<AiMatchingService>.Instance, configuration);
    var endpoint = new MatchingController(probe, NullLogger<MatchingController>.Instance);
    Check(await endpoint.GetHealth(CancellationToken.None) is ObjectResult { StatusCode: 503 },
        $"{failure.GetType().Name} without navigation still reports unavailable");
}

sealed class ProbeHandler(Func<CancellationToken, Task<HttpResponseMessage>> send) : HttpMessageHandler
{
    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        => send(cancellationToken);
}

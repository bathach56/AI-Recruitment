using System.Text.Json.Serialization;

namespace webAI.Models;

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record ChatRequest(ChatMessage?[]? Messages);

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record ChatMessage(string? Role, string? Content);

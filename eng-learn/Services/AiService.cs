using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using eng_learn.Models;
using Microsoft.Extensions.Caching.Distributed;

namespace eng_learn.Services;

public class AiService(IHttpClientFactory httpClientFactory, IDistributedCache cache, IConfiguration config)
{
    private static readonly JsonSerializerOptions JsonOpts = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    public async Task<AnalyzeResult> AnalyzeAsync(string sentence, bool includeSpoken, string practiceType = "general")
    {
        // Redis 缓存 key：句子内容 + 模式 + 练习类型 hash
        var mode = practiceType == "interview" ? "interview" : (includeSpoken ? "full" : "quick");
        var cacheKey = $"analyze:{ComputeHash(sentence)}:{mode}";
        var cached = await cache.GetStringAsync(cacheKey);
        if (cached != null)
        {
            var cachedResult = JsonSerializer.Deserialize<AnalyzeResult>(cached, JsonOpts)!;
            cachedResult.FromCache = true;
            return cachedResult;
        }

        var result = await CallApiAsync(sentence, includeSpoken, practiceType);

        // 缓存 7 天
        await cache.SetStringAsync(cacheKey, JsonSerializer.Serialize(result, JsonOpts),
            new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = TimeSpan.FromDays(7) });

        return result;
    }

    private async Task<AnalyzeResult> CallApiAsync(string sentence, bool includeSpoken, string practiceType = "general")
    {
        var baseUrl = config["Ai:BaseUrl"]!;
        var apiKey  = config["Ai:ApiKey"]!;
        var model   = config["Ai:Model"]!;

        string prompt;
        if (practiceType == "interview")
        {
            prompt = $"""
You are an interview coach helping a Chinese job seeker give clear, confident English interview answers.

The user provides a rough English answer. Rewrite it as a short, well-structured interview answer following these rules:
- KEEP all technical and professional terms exactly as they are (e.g. runtime environment, REST API, dependency injection) — never replace them with simpler words
- Simplify only the connecting words and sentence structure — short sentences, no fancy filler phrases
- Keep it brief: 3–5 numbered points maximum, each point one short sentence
- Each point should be a clear, standalone idea — easy to remember and say out loud
- Format exactly like this example:
  1. I enjoy working with people and solving problems together.
  2. I have 2 years of experience in customer service.
  3. I am a fast learner and always ask questions when I am unsure.

Then do the following:
- Translate the rewritten answer into Chinese (keep the numbered format)
- List 3–5 key words or phrases with simple Chinese explanations
- In one or two sentences, explain what you improved in the content (not just grammar)

Respond ONLY in this exact format (no extra text or markdown outside the tags):

[SPOKEN]
<numbered interview answer, 3–5 points, simple words>

[TRANSLATION]
<Chinese translation, same numbered format>

[ANALYSIS]
<one item per line: word/phrase - Chinese explanation>

[CORRECTIONS]
<1–2 sentences: what content was improved>

Input answer: "{sentence}"
""";
        }
        else
        {
            var spokenInstruction = includeSpoken
                ? "1. Rewrite it as a locally natural spoken English version. At the same time, you can add your own touch—sometimes my answers are too cliché.\n"
                : "";
            var spokenTag = includeSpoken ? "\n[SPOKEN]\n<natural spoken English>\n" : "";
            var n1 = includeSpoken ? "2" : "1";
            var n2 = includeSpoken ? "3" : "2";
            var n3 = includeSpoken ? "4" : "3";
            var translationOf = includeSpoken ? "spoken version" : "original sentence";

            prompt = $"""
You are an English learning assistant helping a Chinese learner.
The user provides an English sentence. Do the following:
{spokenInstruction}{n1}. Translate the {translationOf} into Chinese.
{n2}. List key vocabulary and phrases with Chinese explanations.
{n3}. Point out spelling mistakes, grammar errors, or unnatural expressions in the ORIGINAL sentence. If there are no issues, write: No issues found.

Respond ONLY in this exact format (no extra text or markdown outside the tags):
{spokenTag}
[TRANSLATION]
<Chinese translation>

[ANALYSIS]
<one item per line: word/phrase - Chinese explanation>

[CORRECTIONS]
<one issue per line: "original text" → correction - Chinese explanation; or "No issues found">

Input sentence: "{sentence}"
""";
        }

        var requestBody = new
        {
            model,
            messages = new[] { new { role = "user", content = prompt } }
        };

        var client = httpClientFactory.CreateClient("AI");
        client.DefaultRequestHeaders.Clear();
        client.DefaultRequestHeaders.Add("Authorization", $"Bearer {apiKey}");

        var response = await client.PostAsJsonAsync($"{baseUrl}/chat/completions", requestBody);
        response.EnsureSuccessStatusCode();

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        var text = json.GetProperty("choices")[0].GetProperty("message").GetProperty("content").GetString() ?? "";

        return ParseResponse(text, includeSpoken || practiceType == "interview");
    }

    private static AnalyzeResult ParseResponse(string text, bool includeSpoken)
    {
        static string GetSection(string content, string tag)
        {
            var pattern = $"[{tag}]";
            var start = content.IndexOf(pattern, StringComparison.OrdinalIgnoreCase);
            if (start < 0) return string.Empty;
            start += pattern.Length;
            var end = content.IndexOf('[', start);
            return (end < 0 ? content[start..] : content[start..end]).Trim();
        }

        return new AnalyzeResult
        {
            Spoken      = includeSpoken ? GetSection(text, "SPOKEN") : string.Empty,
            Translation = GetSection(text, "TRANSLATION"),
            Analysis    = GetSection(text, "ANALYSIS"),
            Corrections = GetSection(text, "CORRECTIONS"),
        };
    }

    private static string ComputeHash(string input)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(input));
        return Convert.ToHexString(bytes)[..16];
    }
}

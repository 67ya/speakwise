using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using eng_learn.Models;
using Microsoft.Extensions.Caching.Distributed;

namespace eng_learn.Services;

public class AiService(IHttpClientFactory httpClientFactory, IDistributedCache cache, IConfiguration config)
{
    private static readonly JsonSerializerOptions JsonOpts = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    // ── Analyze (existing) ──────────────────────────────────────────────────

    public async Task<AnalyzeResult> AnalyzeAsync(string sentence, bool includeSpoken, string practiceType = "general")
    {
        var mode = practiceType == "interview" ? "interview" : (includeSpoken ? "full" : "quick");
        var cacheKey = $"analyze:{ComputeHash(sentence)}:{mode}";
        var cached = await cache.GetStringAsync(cacheKey);
        if (cached != null)
        {
            var cachedResult = JsonSerializer.Deserialize<AnalyzeResult>(cached, JsonOpts)!;
            cachedResult.FromCache = true;
            return cachedResult;
        }

        var result = await CallAnalyzeAsync(sentence, includeSpoken, practiceType);

        await cache.SetStringAsync(cacheKey, JsonSerializer.Serialize(result, JsonOpts),
            new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = TimeSpan.FromDays(7) });

        return result;
    }

    private async Task<AnalyzeResult> CallAnalyzeAsync(string sentence, bool includeSpoken, string practiceType)
    {
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

        var text = await CallAiRawAsync(prompt);
        return ParseAnalyzeResponse(text, includeSpoken || practiceType == "interview");
    }

    private static AnalyzeResult ParseAnalyzeResponse(string text, bool includeSpoken)
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

    // ── Daily (Chinese → spoken English) ───────────────────────────────────

    public async Task<DailyResult> DailyAsync(string chinese)
    {
        var cacheKey = $"daily:{ComputeHash(chinese)}";
        var cached = await cache.GetStringAsync(cacheKey);
        if (cached != null)
        {
            var r = JsonSerializer.Deserialize<DailyResult>(cached, JsonOpts)!;
            r.FromCache = true;
            return r;
        }

        var result = await CallDailyAsync(chinese);
        await cache.SetStringAsync(cacheKey, JsonSerializer.Serialize(result, JsonOpts),
            new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = TimeSpan.FromDays(7) });
        return result;
    }

    private async Task<DailyResult> CallDailyAsync(string chinese)
    {
        var prompt = $"""
You are an English speaking coach helping a Chinese learner express themselves in natural spoken English.

The user provides a Chinese sentence. Do the following:
1. Write a natural spoken English version (casual, fluent — the way a native speaker would actually say it)
2. Pick 3–5 key English words or phrases from the spoken version. For each one, give a concise Chinese meaning explanation. Do NOT include pinyin, do NOT include Chinese sentences — only the English word/phrase and its Chinese meaning.

Respond ONLY in this exact format:

[SPOKEN]
<natural spoken English>

[VOCABULARY]
<one item per line: English word/phrase - Chinese meaning (e.g. "hang out - 闲逛，消磨时间")>

Chinese sentence: "{chinese}"
""";

        var text = await CallAiRawAsync(prompt);
        return ParseDailyResponse(text);
    }

    private static DailyResult ParseDailyResponse(string text)
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

        return new DailyResult
        {
            Spoken     = GetSection(text, "SPOKEN"),
            Vocabulary = GetSection(text, "VOCABULARY"),
        };
    }

    // ── Code Analysis ──────────────────────────────────────────────────────

    public async Task<CodeResult> CodeAsync(string code)
    {
        var cacheKey = $"code:{ComputeHash(code)}";
        var cached = await cache.GetStringAsync(cacheKey);
        if (cached != null)
        {
            var r = JsonSerializer.Deserialize<CodeResult>(cached, JsonOpts)!;
            r.FromCache = true;
            return r;
        }

        var result = await CallCodeAsync(code);
        await cache.SetStringAsync(cacheKey, JsonSerializer.Serialize(result, JsonOpts),
            new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = TimeSpan.FromDays(7) });
        return result;
    }

    private async Task<CodeResult> CallCodeAsync(string code)
    {
        var prompt = $$""""
You are a code analysis assistant. Analyze the following code.

1. Summarize what this code does in exactly 10 Chinese characters (no more, no less)
2. Copy every single line of the original code exactly as-is, and add a short Chinese comment (用中文注释) at the end of each code line using # as the comment prefix. Place the comment at the very end of the line. Do NOT omit any lines. The output must be the complete original code with Chinese comments added inline. All comments MUST be in Chinese (中文).

Respond ONLY in this exact format:

[SUMMARY]
<10-char Chinese summary>

[ANALYSIS]
<complete original code, every line preserved, with Chinese inline comments appended>

Code:
"""
{{code}}
"""
"""";

        var text = await CallAiRawAsync(prompt);
        return ParseCodeResponse(text);
    }

    private static CodeResult ParseCodeResponse(string text)
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

        return new CodeResult
        {
            Summary  = GetSection(text, "SUMMARY"),
            Analysis = GetSection(text, "ANALYSIS"),
        };
    }

    // ── Random Conversation ─────────────────────────────────────────────────

    public async Task<ConversationResult> RandomConversationAsync(string? topic)
    {
        var topicStr = string.IsNullOrWhiteSpace(topic)
            ? "a random everyday topic (weather, food, travel, work, or weekend plans)"
            : topic;

        var prompt = $"""
Generate a natural English conversation based on the following scenario: {topicStr}

Rules:
- 6–12 exchanges total (alternate between speaker A and speaker B)
- Always label speakers as A and B regardless of their roles in the scenario
- Match the language register to the scenario: formal/professional for interviews or workplace settings, casual for everyday topics
- For each line provide the Chinese translation and 2–3 key vocabulary items from that line

Respond ONLY in this exact format (repeat [LINE] blocks, no other text):

[LINE]
SPEAKER: A
EN: <English sentence>
ZH: <Chinese translation>
VOCAB: <word/phrase - Chinese> | <word/phrase - Chinese>

[LINE]
SPEAKER: B
EN: <English sentence>
ZH: <Chinese translation>
VOCAB: <word/phrase - Chinese> | <word/phrase - Chinese>
""";

        var text = await CallAiRawAsync(prompt);
        return ParseConversation(text);
    }

    private static ConversationResult ParseConversation(string text)
    {
        var lines = new List<ConversationLine>();
        var blocks = text.Split("[LINE]", StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        foreach (var block in blocks)
        {
            var line = new ConversationLine();
            foreach (var row in block.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            {
                if (row.StartsWith("SPEAKER:", StringComparison.OrdinalIgnoreCase))
                    line.Speaker = row[8..].Trim();
                else if (row.StartsWith("EN:", StringComparison.OrdinalIgnoreCase))
                    line.English = row[3..].Trim();
                else if (row.StartsWith("ZH:", StringComparison.OrdinalIgnoreCase))
                    line.Chinese = row[3..].Trim();
                else if (row.StartsWith("VOCAB:", StringComparison.OrdinalIgnoreCase))
                    line.Vocabulary = row[6..].Trim().Replace(" | ", "\n");
            }
            if (!string.IsNullOrEmpty(line.English))
                lines.Add(line);
        }

        return new ConversationResult { Lines = lines };
    }

    // ── Shared HTTP helper ──────────────────────────────────────────────────

    private async Task<string> CallAiRawAsync(string prompt)
    {
        var baseUrl = config["Ai:BaseUrl"]!;
        var apiKey  = config["Ai:ApiKey"]!;
        var model   = config["Ai:Model"]!;

        var requestBody = new
        {
            model,
            messages = new[] { new { role = "user", content = prompt } }
        };

        var httpClient = httpClientFactory.CreateClient("AI");
        httpClient.DefaultRequestHeaders.Clear();
        httpClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {apiKey}");

        var response = await httpClient.PostAsJsonAsync($"{baseUrl}/chat/completions", requestBody);
        response.EnsureSuccessStatusCode();

        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        return json.GetProperty("choices")[0].GetProperty("message").GetProperty("content").GetString() ?? "";
    }

    // ── Exam Scoring ────────────────────────────────────────────────────────

    public async Task<ExamScoreResult> ScoreExamAsync(ExamScoreRequest req)
    {
        var sb = new StringBuilder();
        sb.AppendLine("You are an English exam grader. Grade each answer below strictly and return scores.");
        sb.AppendLine();
        sb.AppendLine("Scoring rules:");
        sb.AppendLine("For English/Daily type (max 100 per card):");
        sb.AppendLine("  - Ignore: capitalization errors, extra/missing spaces, punctuation differences — these do NOT deduct any points");
        sb.AppendLine("  - Spelling mistake (wrong letters in a word) or clear grammar error: -5 each");
        sb.AppendLine("  - Overall meaning has deviation: -20");
        sb.AppendLine("  - Meaning completely wrong or blank: -50");
        sb.AppendLine("For Code type (max 100 per card, 5 blanks × 20 pts each):");
        sb.AppendLine("  - Each blank: correct = 20 pts, wrong/blank = 0 pts");
        sb.AppendLine("  - Compare semantically, not literally — same meaning = correct");
        sb.AppendLine();
        sb.AppendLine("Respond ONLY with this exact format, one [ANSWER] block per input:");
        sb.AppendLine();
        sb.AppendLine("[ANSWER]");
        sb.AppendLine("ID: <entryId>");
        sb.AppendLine("SCORE: <0-100>");
        sb.AppendLine("DEDUCTION: <total deducted>");
        sb.AppendLine("COMMENT: <brief Chinese feedback, 1-2 sentences>");
        sb.AppendLine();

        foreach (var ans in req.Answers)
        {
            sb.AppendLine($"[ANSWER]");
            sb.AppendLine($"ID: {ans.EntryId}");
            sb.AppendLine($"TYPE: {ans.Type}");

            if (ans.Type == "code")
            {
                var expected = ans.CodeBlanks.Split("|||");
                var inputs   = ans.CodeInputs.Split("|||");
                sb.AppendLine("Blanks to grade:");
                for (int i = 0; i < Math.Min(expected.Length, 5); i++)
                {
                    var exp = i < expected.Length ? expected[i] : "";
                    var inp = i < inputs.Length   ? inputs[i]   : "";
                    sb.AppendLine($"  Blank {i + 1}: expected=\"{exp}\" user=\"{inp}\"");
                }
            }
            else
            {
                sb.AppendLine($"PROMPT: {ans.Prompt}");
                sb.AppendLine($"EXPECTED: {ans.Expected}");
                sb.AppendLine($"USER_INPUT: {ans.Input}");
            }
            sb.AppendLine();
        }

        var text = await CallAiRawAsync(sb.ToString());
        return ParseExamScore(text, req.Answers);
    }

    private static ExamScoreResult ParseExamScore(string text, List<ExamAnswer> answers)
    {
        var feedbacks = new List<AnswerFeedback>();
        var blocks = text.Split("[ANSWER]", StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        foreach (var block in blocks)
        {
            var fb = new AnswerFeedback();
            int parsedId = -1;
            foreach (var row in block.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            {
                if (row.StartsWith("ID:", StringComparison.OrdinalIgnoreCase)
                    && int.TryParse(row[3..].Trim(), out var id))
                    parsedId = id;
                else if (row.StartsWith("SCORE:", StringComparison.OrdinalIgnoreCase)
                    && int.TryParse(row[6..].Trim(), out var sc))
                    fb.Score = Math.Clamp(sc, 0, 100);
                else if (row.StartsWith("DEDUCTION:", StringComparison.OrdinalIgnoreCase)
                    && int.TryParse(row[10..].Trim(), out var ded))
                    fb.Deduction = ded;
                else if (row.StartsWith("COMMENT:", StringComparison.OrdinalIgnoreCase))
                    fb.Comment = row[8..].Trim();
            }
            if (parsedId >= 0)
            {
                fb.EntryId = parsedId;
                feedbacks.Add(fb);
            }
        }

        // Fill in any missing entries with 0 score
        var gradedIds = feedbacks.Select(f => f.EntryId).ToHashSet();
        foreach (var ans in answers)
        {
            if (!gradedIds.Contains(ans.EntryId))
                feedbacks.Add(new AnswerFeedback { EntryId = ans.EntryId, Score = 0, Deduction = 100, Comment = "未收到评分" });
        }

        var total = feedbacks.Count > 0
            ? (int)Math.Round(feedbacks.Average(f => f.Score))
            : 0;

        return new ExamScoreResult { TotalScore = total, Feedbacks = feedbacks };
    }

    private static string ComputeHash(string input)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(input));
        return Convert.ToHexString(bytes)[..16];
    }
}

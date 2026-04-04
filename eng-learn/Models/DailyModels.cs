using System.ComponentModel.DataAnnotations;

namespace eng_learn.Models;

public class DailyRequest
{
    [Required]
    public string Chinese { get; set; } = string.Empty;
}

public class RandomConversationRequest
{
    public string? Topic { get; set; }
}

public class DailyResult
{
    public string Spoken { get; set; } = string.Empty;
    public string Vocabulary { get; set; } = string.Empty;
    public bool FromCache { get; set; } = false;
}

public class ConversationLine
{
    public string Speaker { get; set; } = string.Empty;
    public string English { get; set; } = string.Empty;
    public string Chinese { get; set; } = string.Empty;
    public string Vocabulary { get; set; } = string.Empty;
}

public class ConversationResult
{
    public List<ConversationLine> Lines { get; set; } = [];
}

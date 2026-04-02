using System.ComponentModel.DataAnnotations;

namespace eng_learn.Models;

public class AnalyzeRequest
{
    [Required]
    public string Sentence { get; set; } = string.Empty;

    public bool IncludeSpoken { get; set; } = false;

    public string PracticeType { get; set; } = "general";
}

public class AnalyzeResult
{
    public string Spoken { get; set; } = string.Empty;
    public string Translation { get; set; } = string.Empty;
    public string Analysis { get; set; } = string.Empty;
    public string Corrections { get; set; } = string.Empty;
    public bool FromCache { get; set; } = false;
}

namespace eng_learn.Models;

public class CodeResult
{
    public string Summary  { get; set; } = string.Empty;
    public string Analysis { get; set; } = string.Empty;
    public bool   FromCache { get; set; } = false;
}

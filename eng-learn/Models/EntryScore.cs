using System.ComponentModel.DataAnnotations;

namespace eng_learn.Models;

public class EntryScore
{
    [Key]
    public int EntryId    { get; set; }
    public int LastScore  { get; set; }
    public int ExamCount  { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

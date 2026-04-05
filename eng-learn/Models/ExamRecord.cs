using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace eng_learn.Models;

public class ExamRecord
{
    public int Id { get; set; }

    [Required, MaxLength(60)]
    public string Date { get; set; } = string.Empty;

    public int TotalScore  { get; set; }
    public int CardCount   { get; set; }
    public int DurationSec { get; set; }

    // HistoryItem[] 序列化为 JSON 存储
    [Column(TypeName = "longtext")]
    public string ItemsJson { get; set; } = "[]";

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

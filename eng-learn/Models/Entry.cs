using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace eng_learn.Models;

public class Entry
{
    public long Id { get; set; }

    [Column(TypeName = "text")]
    public string? Question { get; set; }

    [Required, MaxLength(2000)]
    public string Original { get; set; } = string.Empty;

    [Column(TypeName = "text")]
    public string Spoken { get; set; } = string.Empty;

    [MaxLength(2000)]
    public string Translation { get; set; } = string.Empty;

    [Column(TypeName = "text")]
    public string Analysis { get; set; } = string.Empty;

    [Column(TypeName = "text")]
    public string Corrections { get; set; } = string.Empty;

    public DateTime Timestamp { get; set; } = DateTime.UtcNow;

    [MaxLength(20)]
    public string? Color { get; set; }

    public int? CategoryId { get; set; }
    public Category? Category { get; set; }
}

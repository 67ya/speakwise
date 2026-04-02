using System.ComponentModel.DataAnnotations;

namespace eng_learn.Models;

public class Category
{
    public int Id { get; set; }

    [Required, MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    public ICollection<Entry> Entries { get; set; } = new List<Entry>();
}

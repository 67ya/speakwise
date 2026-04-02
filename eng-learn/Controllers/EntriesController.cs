using eng_learn.Data;
using eng_learn.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace eng_learn.Controllers;

[ApiController]
[Route("api/[controller]")]
public class EntriesController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll() =>
        Ok(await db.Entries.OrderByDescending(e => e.Timestamp).ToListAsync());

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] EntryCreateDto dto)
    {
        var entry = new Entry
        {
            Question    = dto.Question,
            Original    = dto.Original,
            Spoken      = dto.Spoken,
            Translation = dto.Translation,
            Analysis    = dto.Analysis,
            Corrections = dto.Corrections,
            CategoryId  = dto.CategoryId,
            Color       = dto.Color,
            Timestamp   = dto.Timestamp ?? DateTime.UtcNow,
        };
        db.Entries.Add(entry);
        await db.SaveChangesAsync();
        return Ok(entry);
    }

    // 单独更新颜色
    [HttpPatch("{id}/color")]
    public async Task<IActionResult> UpdateColor(long id, [FromBody] ValueDto<string?> dto)
    {
        var entry = await db.Entries.FindAsync(id);
        if (entry == null) return NotFound();
        entry.Color = dto.Value;
        await db.SaveChangesAsync();
        return Ok(entry);
    }

    // 单独更新分类
    [HttpPatch("{id}/category")]
    public async Task<IActionResult> UpdateCategory(long id, [FromBody] ValueDto<int?> dto)
    {
        var entry = await db.Entries.FindAsync(id);
        if (entry == null) return NotFound();
        entry.CategoryId = dto.Value;
        await db.SaveChangesAsync();
        return Ok(entry);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(long id)
    {
        var entry = await db.Entries.FindAsync(id);
        if (entry == null) return NotFound();
        db.Entries.Remove(entry);
        await db.SaveChangesAsync();
        return Ok(new { ok = true });
    }
}

public record EntryCreateDto(
    string? Question, string Original, string Spoken,
    string Translation, string Analysis, string Corrections,
    int? CategoryId, string? Color, DateTime? Timestamp);

public record ValueDto<T>(T Value);

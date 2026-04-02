using System.ComponentModel.DataAnnotations;
using eng_learn.Data;
using eng_learn.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace eng_learn.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CategoriesController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll() =>
        Ok(await db.Categories.OrderBy(c => c.Id).ToListAsync());

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CategoryDto dto)
    {
        var category = new Category { Name = dto.Name };
        db.Categories.Add(category);
        await db.SaveChangesAsync();
        return Ok(category);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] CategoryDto dto)
    {
        var category = await db.Categories.FindAsync(id);
        if (category == null) return NotFound();
        category.Name = dto.Name;
        await db.SaveChangesAsync();
        return Ok(category);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var count = await db.Entries.CountAsync(e => e.CategoryId == id);
        if (count > 0)
            return BadRequest(new { error = $"该分类下还有 {count} 条记录，请先删除后再删除分类" });

        var category = await db.Categories.FindAsync(id);
        if (category == null) return NotFound();
        db.Categories.Remove(category);
        await db.SaveChangesAsync();
        return Ok(new { ok = true });
    }
}

public record CategoryDto([Required] string Name);

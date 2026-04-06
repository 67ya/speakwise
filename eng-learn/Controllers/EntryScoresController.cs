using eng_learn.Data;
using eng_learn.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace eng_learn.Controllers;

[ApiController, Route("api/entry-scores")]
public class EntryScoresController(AppDbContext db) : ControllerBase
{
    // GET /api/entry-scores  → { entryId: lastScore }
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var scores = await db.EntryScores
            .Select(s => new { s.EntryId, s.LastScore, s.ExamCount })
            .ToListAsync();
        return Ok(scores);
    }

    // POST /api/entry-scores  body: [{ entryId, score }]
    [HttpPost]
    public async Task<IActionResult> Upsert([FromBody] List<EntryScoreItem> items)
    {
        if (items == null || items.Count == 0) return BadRequest();

        foreach (var item in items)
        {
            var existing = await db.EntryScores.FindAsync(item.EntryId);
            if (existing == null)
            {
                db.EntryScores.Add(new EntryScore
                {
                    EntryId   = item.EntryId,
                    LastScore = item.Score,
                    ExamCount = 1,
                    UpdatedAt = DateTime.UtcNow,
                });
            }
            else
            {
                existing.LastScore = item.Score;
                existing.ExamCount++;
                existing.UpdatedAt = DateTime.UtcNow;
            }
        }
        await db.SaveChangesAsync();
        return Ok();
    }
}

public record EntryScoreItem(int EntryId, int Score);

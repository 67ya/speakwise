using eng_learn.Data;
using eng_learn.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace eng_learn.Controllers;

[ApiController, Route("api/exam/history")]
public class ExamHistoryController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var records = await db.ExamRecords
            .OrderByDescending(r => r.CreatedAt)
            .Take(20)
            .Select(r => new {
                r.Id, r.Date, r.TotalScore, r.CardCount, r.DurationSec, r.ItemsJson
            })
            .ToListAsync();
        return Ok(records);
    }

    [HttpPost]
    public async Task<IActionResult> Save([FromBody] SaveExamRequest req)
    {
        var record = new ExamRecord
        {
            Date        = req.Date,
            TotalScore  = req.TotalScore,
            CardCount   = req.CardCount,
            DurationSec = req.DurationSec,
            ItemsJson   = req.ItemsJson,
        };
        db.ExamRecords.Add(record);
        await db.SaveChangesAsync();
        return Ok(new { record.Id });
    }
}

public record SaveExamRequest(string Date, int TotalScore, int CardCount, int DurationSec, string ItemsJson);

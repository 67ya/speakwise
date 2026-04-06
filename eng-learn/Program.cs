using eng_learn.Data;
using eng_learn.Services;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// 本地敏感配置（gitignored），覆盖 appsettings.json 中的占位符
builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true, reloadOnChange: false);

// EF Core + MySQL
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseMySql(
        builder.Configuration.GetConnectionString("DefaultConnection"),
        ServerVersion.AutoDetect(builder.Configuration.GetConnectionString("DefaultConnection"))
    )
);

// Redis 分布式缓存（开发环境无 Redis 时降级为内存缓存）
var redisConn = builder.Configuration.GetConnectionString("Redis");
if (!string.IsNullOrWhiteSpace(redisConn))
    builder.Services.AddStackExchangeRedisCache(options => options.Configuration = redisConn);
else
    builder.Services.AddDistributedMemoryCache();

// HttpClient for AI
builder.Services.AddHttpClient("AI");
builder.Services.AddScoped<AiService>();

// CORS
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()!;
builder.Services.AddCors(options =>
    options.AddDefaultPolicy(policy =>
        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod())
);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

// 自动建表（EnsureCreated 对已存在的库不会补建新表，所以用 IF NOT EXISTS 手动补）
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.EnsureCreated();
    db.Database.ExecuteSqlRaw("""
        CREATE TABLE IF NOT EXISTS `ExamRecords` (
            `Id`          INT          NOT NULL AUTO_INCREMENT,
            `Date`        VARCHAR(60)  NOT NULL,
            `TotalScore`  INT          NOT NULL,
            `CardCount`   INT          NOT NULL,
            `DurationSec` INT          NOT NULL,
            `ItemsJson`   LONGTEXT     NOT NULL,
            `CreatedAt`   DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
            PRIMARY KEY (`Id`)
        ) CHARACTER SET utf8mb4;
        """);
    db.Database.ExecuteSqlRaw("""
        CREATE TABLE IF NOT EXISTS `EntryScores` (
            `EntryId`   INT          NOT NULL,
            `LastScore` INT          NOT NULL DEFAULT 0,
            `ExamCount` INT          NOT NULL DEFAULT 0,
            `UpdatedAt` DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
            PRIMARY KEY (`EntryId`)
        ) CHARACTER SET utf8mb4;
        """);
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors();
app.UseAuthorization();
app.MapControllers();

app.Run();

using System.ComponentModel.DataAnnotations;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);
builder.Logging.ClearProviders();
builder.Logging.AddConsole();
var connectionString = Environment.GetEnvironmentVariable("ConnectionStrings__UsersDb");
if (string.IsNullOrWhiteSpace(connectionString))
    throw new InvalidOperationException("Defina a variável de ambiente ConnectionStrings__UsersDb.");

builder.Services.AddDbContext<UsersDb>(options => options.UseSqlite(connectionString));
builder.Services.AddProblemDetails();
var app = builder.Build();
app.UseExceptionHandler();
var servesFrontend = Directory.Exists(app.Environment.WebRootPath);
if (servesFrontend)
{
    app.UseDefaultFiles();
    app.UseStaticFiles();
}

using (var scope = app.Services.CreateScope())
    await scope.ServiceProvider.GetRequiredService<UsersDb>().Database.EnsureCreatedAsync();

app.MapGet("/api/health", async (UsersDb db, CancellationToken ct) =>
    await db.Database.CanConnectAsync(ct) ? Results.Ok(new { status = "ok" }) : Results.StatusCode(503));

app.MapGet("/api/users", async (UsersDb db, CancellationToken ct) =>
    Results.Ok(await db.Users.AsNoTracking().OrderBy(u => u.Name).ThenBy(u => u.Id).ToListAsync(ct)));

app.MapGet("/api/users/{id:int}", async (int id, UsersDb db, CancellationToken ct) =>
    await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == id, ct) is { } user
        ? Results.Ok(user) : Results.NotFound(new { message = "Usuário não encontrado." }));

app.MapPost("/api/users", async (UserInput input, UsersDb db, CancellationToken ct) =>
{
    var errors = input.Validate();
    if (errors.Count > 0) return Results.ValidationProblem(errors);
    var user = new User { Name = input.Name!.Trim(), Email = input.Email!.Trim().ToLowerInvariant(), IsActive = input.IsActive, CreatedAt = DateTime.UtcNow };
    db.Users.Add(user);
    try { await db.SaveChangesAsync(ct); }
    catch (DbUpdateException ex) when (IsDuplicateEmail(ex))
    { return Results.Conflict(new { message = "Já existe um usuário com este e-mail." }); }
    return Results.Created($"/api/users/{user.Id}", user);
});

app.MapPut("/api/users/{id:int}", async (int id, UserInput input, UsersDb db, CancellationToken ct) =>
{
    var errors = input.Validate();
    if (errors.Count > 0) return Results.ValidationProblem(errors);
    var user = await db.Users.FindAsync([id], ct);
    if (user is null) return Results.NotFound(new { message = "Usuário não encontrado." });
    user.Name = input.Name!.Trim();
    user.Email = input.Email!.Trim().ToLowerInvariant();
    user.IsActive = input.IsActive;
    try { await db.SaveChangesAsync(ct); }
    catch (DbUpdateException ex) when (IsDuplicateEmail(ex))
    { return Results.Conflict(new { message = "Já existe um usuário com este e-mail." }); }
    catch (DbUpdateConcurrencyException)
    { return Results.NotFound(new { message = "Usuário não encontrado." }); }
    return Results.Ok(user);
});

app.MapDelete("/api/users/{id:int}", async (int id, UsersDb db, CancellationToken ct) =>
{
    var deleted = await db.Users.Where(u => u.Id == id).ExecuteDeleteAsync(ct);
    return deleted == 0 ? Results.NotFound(new { message = "Usuário não encontrado." }) : Results.NoContent();
});

app.MapFallback("/api/{**path}", () => Results.NotFound(new { message = "Endpoint não encontrado." }));
if (servesFrontend) app.MapFallbackToFile("index.html");
app.Run();

static bool IsDuplicateEmail(DbUpdateException ex) =>
    ex.InnerException is SqliteException { SqliteExtendedErrorCode: 2067 };

public sealed class User
{
    public int Id { get; set; }
    public required string Name { get; set; }
    public required string Email { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
}

public sealed record UserInput(string? Name, string? Email, bool IsActive = true)
{
    public Dictionary<string, string[]> Validate()
    {
        var errors = new Dictionary<string, string[]>();
        if (string.IsNullOrWhiteSpace(Name) || Name.Trim().Length is < 2 or > 120)
            errors["name"] = ["Informe um nome entre 2 e 120 caracteres."];
        if (string.IsNullOrWhiteSpace(Email) || Email.Trim().Length > 254 || !new EmailAddressAttribute().IsValid(Email.Trim()))
            errors["email"] = ["Informe um e-mail válido com até 254 caracteres."];
        return errors;
    }
}

public sealed class UsersDb(DbContextOptions<UsersDb> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        var user = modelBuilder.Entity<User>();
        user.ToTable("Users");
        user.Property(u => u.Name).HasMaxLength(120).IsRequired();
        user.Property(u => u.Email).HasMaxLength(254).IsRequired();
        user.HasIndex(u => u.Email).IsUnique();
    }
}

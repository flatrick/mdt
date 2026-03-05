---
paths:
  - "**/*.cs"
  - "**/*.vb"
---
# .NET Testing

> This file extends [common/testing.md](../common/testing.md) with .NET specific content.

## Framework

Use **xUnit** as the primary testing framework with **Moq** for mocking and **FluentAssertions** for readable assertions.

```bash
dotnet add package xunit
dotnet add package Moq
dotnet add package FluentAssertions
dotnet add package Microsoft.AspNetCore.Mvc.Testing  # For integration tests
```

## Coverage

```bash
dotnet test --collect:"XPlat Code Coverage"
dotnet tool install --global dotnet-reportgenerator-globaltool
reportgenerator -reports:"**/coverage.cobertura.xml" -targetdir:"coverage"
```

## Test Organization

```csharp
// Naming: MethodName_StateUnderTest_ExpectedBehavior
public class UserServiceTests
{
    [Fact]
    public async Task CreateUser_WithValidData_ReturnsCreatedUser()
    {
        // Arrange
        var mockRepo = new Mock<IUserRepository>();
        mockRepo.Setup(r => r.SaveAsync(It.IsAny<User>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync((User u, CancellationToken _) => u);
        var sut = new UserService(mockRepo.Object);

        // Act
        var result = await sut.CreateUserAsync("Alice", "alice@example.com");

        // Assert
        result.Should().NotBeNull();
        result.Name.Should().Be("Alice");
    }

    [Theory]
    [InlineData("")]
    [InlineData(null)]
    [InlineData("   ")]
    public async Task CreateUser_WithInvalidName_ThrowsArgumentException(string invalidName)
    {
        var sut = new UserService(Mock.Of<IUserRepository>());
        await Assert.ThrowsAsync<ArgumentException>(() =>
            sut.CreateUserAsync(invalidName, "test@example.com"));
    }
}
```

## Reference

See skill: `dotnet-patterns` for detailed xUnit patterns, integration testing with WebApplicationFactory, and database testing.

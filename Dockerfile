# 阶段一：构建
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS builder
WORKDIR /app
COPY . .
RUN dotnet publish -c Release -o /out

# 阶段二：运行
FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=builder /out .
EXPOSE 8080
CMD ["dotnet", "english_learn.dll"]
# Basic Example: Todo API

Bu örnek, `@developersailor/gea-openapi-decorators` paketinin **Ahead-of-Time (AOT)** kod üretimi ve sıfır-reflection Hono route bağlanışını gösterir.

## Dosya Yapısı

- [src/controllers/todo.controller.ts](file:///Users/mehmetfiskindal/Developer/gea-openapi-decorators/examples/basic/src/controllers/todo.controller.ts): `@Controller`, `@Get`, `@Post`, `@Delete`, `@Param`, `@Query`, `@Body` decorator'ları ile tanımlanmış CRUD controller.
- [src/models/todo.dto.ts](file:///Users/mehmetfiskindal/Developer/gea-openapi-decorators/examples/basic/src/models/todo.dto.ts): `@ApiProperty` ile modellenmiş DTO sınıfları.
- [src/routes.generated.ts](file:///Users/mehmetfiskindal/Developer/gea-openapi-decorators/examples/basic/src/routes.generated.ts): CLI tarafından otomatik üretilen reflection içermeyen statik Hono route'ları.
- [src/openapi.json](file:///Users/mehmetfiskindal/Developer/gea-openapi-decorators/examples/basic/src/openapi.json): CLI tarafından otomatik üretilen OpenAPI 3.1 spesifikasyonu.
- [src/server.ts](file:///Users/mehmetfiskindal/Developer/gea-openapi-decorators/examples/basic/src/server.ts): Hono uygulamasını başlatan ve statik route'ları bağlayan sunucu dosyası.

---

## Çalıştırma Adımları

### 1. Route ve OpenAPI Kodunu Yeniden Üretmek (Codegen)

Kök dizinden:
```bash
npm run example:codegen
```

veya `examples/basic` klasörü içinden:
```bash
npx gea-openapi codegen
```

### 2. Canlı HTTP Sunucusunu Test Etmek

Kök dizinden:
```bash
npm run example:test
```

Tüm CRUD endpoint'leri (GET, POST, GET/:id, DELETE/:id, Query search) otomatik olarak test edilip doğrulanır.

### 3. GeaStack Yerel C++ Derlemesini Doğrulamak

```bash
# GeaStack AOT analiz ve sertifikasyon (0 refusal):
npm run test:geastack

# Controller'ı doğrudan C++'a derlemek için:
geatsc compile examples/basic/src/controllers/todo.controller.ts --out-dir dist-geatsc --project tests/tsconfig.geastack.json

# Yerel makine ikilisine derlemek için (Apple Clang):
clang++ -std=c++20 -c dist-geatsc/todo.controller.cpp -I dist-geatsc -o dist-geatsc/todo.controller.o
```
Ayrıntılı analiz ve benchmark için ana dizindeki [GEASTACK.md](../../GEASTACK.md) dokümanını inceleyebilirsiniz.

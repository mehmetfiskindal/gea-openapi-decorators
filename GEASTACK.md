# GeaStack Native C++ Uyumluluğu ve Doğrulama Raporu

Bu doküman, `@developersailor/gea-openapi-decorators` paketinin [GeaStack Compiler](https://github.com/geastack/compiler) (`geatsc`) ile olan uyumluluk testlerini, AOT (Ahead-of-Time) derleme adımlarını ve yerel makine kodu (native binary) üretim süreçlerini belgeler.

---

## ⚡ Arka Plan: GeaStack Neden Reflection Reddeder?

GeaStack (`geatsc`), TypeScript kodunu bir JavaScript motoruna (V8, Hermes vb.) ihtiyaç duymadan **doğrudan yerel C++ ikililerine Ahead-Of-Time (AOT)** derler. 

Klasik Node.js decorator kütüphaneleri (NestJS, Ts.ED, express-openapi-decorators `HonoAdapter` vb.) çalışma zamanında şu dinamik JavaScript kalıplarını kullanır:
1. **Dinamik Sınıf Başlatma**: `new (controllerClass as any)()`
2. **String Üzerinden Metot İndeksleme**: `instance[method.methodName].bind(instance)`
3. **Dinamik Argüman Yayılımı**: `handler(...args)`

C++ derleyicisi derleme anında sabit `vtable` (sanal fonksiyon tablosu), kesin çağrı konvansiyonları ve statik tipler beklediği için bu dinamik JS yapıları GeaStack tarafından **refusal (derleme reddi)** ile sonuçlanır.

---

## 💡 Çözüm: AOT Kod Üretimi (Zero-Reflection)

`@developersailor/gea-openapi-decorators`, bu sorunu derleme öncesi statik AST analizi yaparak çözer:
- Siz NestJS benzeri temiz ve tip güvenli decorator'lar yazarsınız (`@Controller`, `@Get`, `@Post`, `@Body`, `@Param` vb.).
- `gea-openapi codegen` CLI aracı derleme anında çalışarak:
  1. **`routes.generated.ts`**: Doğrudan `const userController = new UserController()` ile sınıfı başlatan ve metotları statik çağıran saf Hono route'ları üretir.
  2. **`openapi.json`**: Eksiksiz OpenAPI 3.1 dokümantasyonu üretir.

---

## 📊 Doğrulanmış GeaStack Test Sonuçları (macOS Apple Silicon)

Ortam: macOS (Darwin arm64), Node v26.8.2, `@geastack/compiler` 1.0.18, Apple Clang (LLVM).

### 1. Controller & Decorator Sertifikasyonu (`geatsc coverage`)
```bash
geatsc coverage examples/basic/src/controllers/todo.controller.ts --project tests/tsconfig.geastack.json --no-derived --no-boxed
```
**Sonuç:**
```text
coverage  examples/basic/src/controllers/todo.controller.ts  (project: tests/tsconfig.geastack.json)

summary: 660 operations, 648 carriers (552 native, 96 boxed); 
         0 refused root(s), 0 derived, 0 unsupported, 0 typecheck error(s); 
         0 lowering blocker(s), 0 capability refusal(s), 0 emission refusal(s), 0 abi blocker(s)
certificate: minted; emitted 2336 line(s) of C++
```
* **0 Refusal**: GeaStack tarafından resmi `certificate: minted` sertifikası alındı.
* **2,336 satır** temiz yerel C++ kodu üretildi.

---

### 2. Üretilen AOT Route'ların Sertifikasyonu (`geatsc coverage`)
```bash
geatsc coverage examples/basic/src/routes.generated.ts --project tests/tsconfig.geastack.json --no-derived --no-boxed
```
**Sonuç:**
```text
coverage  examples/basic/src/routes.generated.ts  (project: tests/tsconfig.geastack.json)

summary: 867 operations, 847 carriers (656 native, 191 boxed); 
         0 refused root(s), 0 derived, 0 unsupported, 0 typecheck error(s); 
         0 lowering blocker(s), 0 capability refusal(s), 0 emission refusal(s), 0 abi blocker(s)
certificate: minted; emitted 2669 line(s) of C++
```
* **0 Refusal**: Resmi `certificate: minted` sertifikası alındı.
* **2,669 satır** C++ kodu hatasız üretildi.

---

### 3. Yerel Makine Koduna Derleme (Native Machine Binary / Apple Clang)

GeaStack'in ürettiği C++ kodları doğrudan Clang ile yerel işlemci ikili dosyasına derlendi:

```bash
# 1. TypeScript'ten C++ üret
geatsc compile examples/basic/src/controllers/todo.controller.ts --out-dir dist-geatsc --project tests/tsconfig.geastack.json

# 2. C++20 ile doğrudan Mach-O ikilisine derle
clang++ -std=c++20 -c dist-geatsc/todo.controller.cpp -I dist-geatsc -o dist-geatsc/todo.controller.o
```
**Doğrulama:**
```bash
$ file dist-geatsc/todo.controller.o
dist-geatsc/todo.controller.o: Mach-O 64-bit object arm64
```
TypeScript controller dosyası, hiçbir JS motoruna gerek kalmadan **768 KB saf yerel ARM64 makine koduna** derlenmiştir.

---

## 🧪 Canlı HTTP Çalışma Testi (Node.js / Bun / Hono)

Paket geliştirme ve test sürecinde Hono motoru üzerinde tam uyumludur:

```bash
npm run example:test
```

**Test Edilen Uç Noktalar:**
- `GET /health` ➔ `200 OK` (`{ status: "ok" }`)
- `GET /todos` ➔ `200 OK` (Tüm kayıtlar)
- `POST /todos` ➔ `201 Created` (Gövde parse edildi, yeni kayıt eklendi)
- `GET /todos/:id` ➔ `200 OK` (Tekil kayıt parametresi)
- `GET /todos?search=Learn` ➔ `200 OK` (Query dizesi arama filtresi)
- `DELETE /todos/:id` ➔ `204 No Content` (Kayıt silindi)

---

## 🛠️ GeaStack Uyum Kuralları (Best Practices)

GeaStack hedefleyen projeler yazarken dikkat edilmesi gerekenler:
1. **DTO Sınıfları**: Model sınıflarında constructor tanımlanmalı veya `new Dto()` ile oluşturulmalıdır (C++ nesne tahsis uyumu).
2. **Strict Property Initialization**: `strict: true` modunda DTO alanlarında `title!: string` veya başlangıç değeri verilmelidir.
3. **Runtime Ayrımı**: Controller dosyalarınızda sadece `@developersailor/gea-openapi-decorators` (decorator ve tipler) import edilmelidir; AST/CLI araçları derleme zamanı paketleridir.

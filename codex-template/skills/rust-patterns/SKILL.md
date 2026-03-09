---
name: rust-patterns
---

# Rust Development Patterns

Idiomatic Rust patterns and best practices for building safe, performant, and maintainable applications.

## When to Activate

- Writing new Rust code or crates
- Reviewing Rust code for correctness and idiom
- Designing APIs for Rust libraries
- Refactoring existing Rust code
- Debugging ownership, lifetime, or borrow-checker errors
- Architecting async Rust applications with tokio

## Core Principles

### 1. Ownership Model and Move Semantics

Rust's ownership system ensures memory safety without a garbage collector. Every value has exactly one owner. When that owner goes out of scope, the value is dropped.

```rust
// Move semantics: ownership transfers on assignment or function call
fn consume(s: String) {
    println!("{}", s);
} // s is dropped here

let name = String::from("Alice");
consume(name);
// println!("{}", name); // ERROR: name was moved

// Clone only when you need two independent copies
let original = String::from("Alice");
let copy = original.clone(); // Explicit, visible cost
consume(original);
println!("{}", copy); // copy is still valid

// Borrow instead of clone when possible
fn greet(name: &str) {
    println!("Hello, {}!", name);
}

let name = String::from("Alice");
greet(&name);       // Borrow: name is still valid
println!("{}", name); // Works fine
```

**Copy types** (cheap to duplicate, no heap allocation) implement `Copy` and are automatically duplicated on assignment: `i32`, `f64`, `bool`, `char`, `[T; N]` where `T: Copy`.

```rust
let x: i32 = 42;
let y = x;  // x is copied, not moved
println!("{} {}", x, y); // Both valid
```

### 2. Error Handling with `Result<T, E>` and the `?` Operator

Rust has no exceptions. Errors are values. All fallible operations return `Result<T, E>` or `Option<T>`.

```rust
use std::fs;
use std::io;

// Basic Result usage
fn read_file(path: &str) -> Result<String, io::Error> {
    fs::read_to_string(path)
}

// The ? operator propagates errors automatically
fn process_config(path: &str) -> Result<Config, io::Error> {
    let contents = fs::read_to_string(path)?; // Returns early if Err
    let config: Config = serde_json::from_str(&contents)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
    Ok(config)
}
```

**Custom error types with `thiserror`** — the standard approach for libraries:

```rust
use thiserror::Error;
use uuid::Uuid;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("User not found: {id}")]
    UserNotFound { id: Uuid },

    #[error("Validation failed: {field} - {message}")]
    Validation { field: String, message: String },

    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
}

// Usage: ? automatically converts sqlx::Error -> AppError via From impl
async fn get_user(pool: &PgPool, id: Uuid) -> Result<User, AppError> {
    let user = sqlx::query_as!(User, "SELECT * FROM users WHERE id = $1", id)
        .fetch_optional(pool)
        .await?  // sqlx::Error -> AppError::Database via #[from]
        .ok_or(AppError::UserNotFound { id })?;
    Ok(user)
}
```

**`anyhow`** — for applications (not libraries) where error type flexibility matters:

```rust
use anyhow::{Context, Result};

fn main() -> Result<()> {
    let config = read_config("config.toml")
        .context("Failed to read configuration file")?;
    run_server(config)
        .context("Server encountered an error")?;
    Ok(())
}
```

**Never use `unwrap()` in production library code.** In binaries, `unwrap()` is acceptable only for infallible operations or programmer errors (misconfigured state at startup).

### 3. Trait-Based Design

Traits define shared behavior. Prefer traits over inheritance and concrete types in function signatures.

```rust
// Define behavior with traits
pub trait Summarize {
    fn summary(&self) -> String;
    fn author(&self) -> &str;

    // Default method — can be overridden
    fn preview(&self) -> String {
        format!("{} by {}", &self.summary()[..50], self.author())
    }
}

struct Article {
    title: String,
    author: String,
    body: String,
}

impl Summarize for Article {
    fn summary(&self) -> String {
        self.title.clone()
    }
    fn author(&self) -> &str {
        &self.author
    }
}
```

**Trait objects (`dyn Trait`)** — dynamic dispatch, heap allocation, runtime polymorphism:

```rust
// Use when: types are unknown at compile time, heterogeneous collection needed
fn notify(items: &[Box<dyn Summarize>]) {
    for item in items {
        println!("{}", item.summary());
    }
}

// Trait objects require object safety (no associated types consuming Self, no generic methods)
```

**Generics (`impl Trait` / `T: Trait`)** — static dispatch, zero-cost abstraction:

```rust
// Use when: types are known at compile time, performance matters
fn notify_all<T: Summarize>(item: &T) {
    println!("{}", item.summary());
}

// impl Trait syntax (equivalent, preferred for simple cases)
fn notify_one(item: &impl Summarize) {
    println!("{}", item.summary());
}

// Multiple bounds
fn format_item<T: Summarize + std::fmt::Debug>(item: &T) -> String {
    format!("{:?}: {}", item, item.summary())
}

// Where clause for complex bounds
fn complex<T, U>(t: &T, u: &U) -> String
where
    T: Summarize + Clone,
    U: std::fmt::Display + std::fmt::Debug,
{
    format!("{} {}", t.summary(), u)
}
```

### 4. Lifetime Annotations

Lifetimes prevent dangling references. The compiler infers most lifetimes; annotations are only needed when the compiler cannot determine relationships.

```rust
// Lifetime elision: compiler infers 'a
fn first_word(s: &str) -> &str {
    s.split_whitespace().next().unwrap_or("")
}

// Explicit lifetime: return borrows from one of the inputs
fn longest<'a>(x: &'a str, y: &'a str) -> &'a str {
    if x.len() > y.len() { x } else { y }
}

// Lifetime in structs: struct cannot outlive the reference it holds
struct Excerpt<'a> {
    text: &'a str,
}

impl<'a> Excerpt<'a> {
    fn level(&self) -> i32 { 3 }

    // Returns reference with same lifetime as self
    fn announce(&self, announcement: &str) -> &str {
        println!("Attention: {}", announcement);
        self.text
    }
}

// 'static lifetime: valid for the entire program duration
// Use sparingly — usually signals string literals or global data
const GREETING: &'static str = "Hello, World!";
fn get_greeting() -> &'static str { "Hi!" }
```

**When you need lifetime annotations:**
- Functions returning references derived from multiple input references
- Structs holding references
- Methods where the return lifetime is ambiguous from the inputs

### 5. Iterators and Functional Patterns

Rust iterators are lazy, composable, and zero-cost. Prefer iterator adaptors over manual loops.

```rust
let numbers = vec![1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// map + filter + collect
let even_squares: Vec<i32> = numbers.iter()
    .filter(|&&x| x % 2 == 0)
    .map(|&x| x * x)
    .collect();

// fold (reduce)
let sum: i32 = numbers.iter().fold(0, |acc, &x| acc + x);
// Or equivalently:
let sum: i32 = numbers.iter().sum();

// flat_map — flatten nested iterators
let words = vec!["hello world", "foo bar"];
let chars: Vec<&str> = words.iter()
    .flat_map(|s| s.split_whitespace())
    .collect();

// chain — concatenate iterators
let a = vec![1, 2, 3];
let b = vec![4, 5, 6];
let combined: Vec<i32> = a.iter().chain(b.iter()).copied().collect();

// enumerate — get index alongside value
for (i, val) in numbers.iter().enumerate() {
    println!("{}: {}", i, val);
}

// zip — pair two iterators
let names = vec!["Alice", "Bob"];
let scores = vec![95, 87];
let paired: Vec<(&str, i32)> = names.iter().copied()
    .zip(scores.iter().copied())
    .collect();

// any / all — short-circuit predicates
let has_even = numbers.iter().any(|&x| x % 2 == 0);
let all_positive = numbers.iter().all(|&x| x > 0);

// find / position
let first_even = numbers.iter().find(|&&x| x % 2 == 0);
let first_even_idx = numbers.iter().position(|&x| x % 2 == 0);

// Custom iterator
struct Counter {
    count: u32,
    max: u32,
}

impl Counter {
    fn new(max: u32) -> Self {
        Counter { count: 0, max }
    }
}

impl Iterator for Counter {
    type Item = u32;

    fn next(&mut self) -> Option<Self::Item> {
        if self.count < self.max {
            self.count += 1;
            Some(self.count)
        } else {
            None
        }
    }
}

let sum: u32 = Counter::new(5).sum(); // 15
```

**Avoid premature `collect()`**: When chaining further operations, keep the iterator lazy.

```rust
// Bad: collects unnecessarily
let result: Vec<i32> = numbers.iter()
    .map(|&x| x * 2)
    .collect::<Vec<_>>()   // unnecessary intermediate collection
    .iter()
    .filter(|&&x| x > 5)
    .copied()
    .collect();

// Good: single lazy chain
let result: Vec<i32> = numbers.iter()
    .map(|&x| x * 2)
    .filter(|&x| x > 5)
    .collect();
```

### 6. Smart Pointers

Choose the right smart pointer for the ownership model:

| Type | Ownership | Thread-safe | Interior mutability |
|------|-----------|-------------|---------------------|
| `Box<T>` | Single owner, heap allocated | Yes (if `T: Send`) | No |
| `Rc<T>` | Multiple owners, reference counted | No | No |
| `Arc<T>` | Multiple owners, atomic ref count | Yes | No |
| `RefCell<T>` | Single owner | No | Yes (runtime checked) |
| `Mutex<T>` | Single owner (behind `Arc`) | Yes | Yes (lock-based) |
| `RwLock<T>` | Single owner (behind `Arc`) | Yes | Yes (readers/writer) |

```rust
use std::rc::Rc;
use std::cell::RefCell;
use std::sync::{Arc, Mutex};

// Box<T>: heap allocation, single owner, recursive types
enum List {
    Cons(i32, Box<List>),
    Nil,
}

// Rc<T>: shared ownership within a single thread
let shared_data = Rc::new(vec![1, 2, 3]);
let clone1 = Rc::clone(&shared_data); // increments ref count
let clone2 = Rc::clone(&shared_data);
println!("References: {}", Rc::strong_count(&shared_data)); // 3

// RefCell<T>: interior mutability (borrow checking at runtime)
let mutable_shared = Rc::new(RefCell::new(vec![1, 2, 3]));
mutable_shared.borrow_mut().push(4); // runtime borrow check

// Arc<Mutex<T>>: shared mutable state across threads
let counter = Arc::new(Mutex::new(0));
let counter_clone = Arc::clone(&counter);

std::thread::spawn(move || {
    let mut lock = counter_clone.lock().unwrap();
    *lock += 1;
});

// RwLock: prefer when reads greatly outnumber writes
use std::sync::RwLock;
let config = Arc::new(RwLock::new(Config::default()));
let config_read = config.read().unwrap(); // multiple concurrent readers
drop(config_read);
let mut config_write = config.write().unwrap(); // exclusive writer
config_write.timeout = 30;
```

**Prefer message passing over shared state** when possible:

```rust
use std::sync::mpsc;

let (tx, rx) = mpsc::channel();
let tx2 = tx.clone();

std::thread::spawn(move || tx.send("from thread 1").unwrap());
std::thread::spawn(move || tx2.send("from thread 2").unwrap());

for received in rx.iter().take(2) {
    println!("{}", received);
}
```

### 7. async/await with tokio

Rust's async model is zero-cost and poll-based. Use `tokio` as the async runtime for most applications.

```toml
# Cargo.toml
[dependencies]
tokio = { version = "1", features = ["full"] }
```

```rust
use tokio::time::{sleep, Duration};

// Basic async function
async fn fetch_data(url: &str) -> Result<String, reqwest::Error> {
    reqwest::get(url).await?.text().await
}

// Entry point
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let data = fetch_data("https://api.example.com/data").await?;
    println!("{}", data);
    Ok(())
}

// Spawn concurrent tasks
async fn run_concurrently() {
    let handle1 = tokio::spawn(async {
        sleep(Duration::from_millis(100)).await;
        "task 1 done"
    });

    let handle2 = tokio::spawn(async {
        sleep(Duration::from_millis(50)).await;
        "task 2 done"
    });

    // Wait for both — returns (Result<&str>, Result<&str>)
    let (r1, r2) = tokio::join!(handle1, handle2);
    println!("{}, {}", r1.unwrap(), r2.unwrap());
}

// select! — race multiple futures, take the first to complete
use tokio::select;

async fn with_timeout(url: &str) -> Option<String> {
    select! {
        result = fetch_data(url) => result.ok(),
        _ = sleep(Duration::from_secs(5)) => {
            eprintln!("Request timed out");
            None
        }
    }
}

// join! — await multiple futures concurrently (all must succeed)
async fn fetch_multiple() -> Result<(String, String), reqwest::Error> {
    let (a, b) = tokio::try_join!(
        fetch_data("https://api.example.com/a"),
        fetch_data("https://api.example.com/b"),
    )?;
    Ok((a, b))
}

// Channels in async context
use tokio::sync::mpsc;

async fn producer_consumer() {
    let (tx, mut rx) = mpsc::channel::<i32>(32);

    tokio::spawn(async move {
        for i in 0..10 {
            tx.send(i).await.expect("receiver dropped");
        }
    });

    while let Some(value) = rx.recv().await {
        println!("Received: {}", value);
    }
}
```

**Critical async rule**: Never use blocking operations inside `async fn`. Use `tokio::task::spawn_blocking` for CPU-bound or blocking I/O:

```rust
async fn read_large_file(path: String) -> Result<String, std::io::Error> {
    // spawn_blocking moves to a thread pool thread
    tokio::task::spawn_blocking(move || {
        std::fs::read_to_string(&path)
    })
    .await
    .expect("blocking task panicked")
}
```

### 8. Cargo Workspace Organization

For multi-crate projects, use a Cargo workspace:

```toml
# Cargo.toml (workspace root)
[workspace]
members = [
    "crates/core",
    "crates/api",
    "crates/cli",
]
resolver = "2"

[workspace.dependencies]
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
thiserror = "1"
```

```toml
# crates/api/Cargo.toml
[package]
name = "api"
version = "0.1.0"
edition = "2021"

[dependencies]
core = { path = "../core" }
tokio = { workspace = true }
serde = { workspace = true }
```

**Recommended workspace layout:**

```text
my-project/
├── Cargo.toml              # Workspace root
├── Cargo.lock
├── crates/
│   ├── core/               # Domain types and business logic (no I/O)
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── models.rs
│   │       └── errors.rs
│   ├── api/                # HTTP layer (axum/actix-web)
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── handlers/
│   │       └── middleware/
│   └── cli/                # Command-line interface
│       ├── Cargo.toml
│       └── src/
│           └── main.rs
└── tests/                  # Integration tests across crates
    └── integration_test.rs
```

### 9. Builder Pattern in Rust

The builder pattern is idiomatic for constructing types with many optional fields.

```rust
use std::time::Duration;

#[derive(Debug)]
pub struct HttpClient {
    base_url: String,
    timeout: Duration,
    max_retries: u32,
    user_agent: String,
    headers: Vec<(String, String)>,
}

#[derive(Default)]
pub struct HttpClientBuilder {
    base_url: Option<String>,
    timeout: Option<Duration>,
    max_retries: Option<u32>,
    user_agent: Option<String>,
    headers: Vec<(String, String)>,
}

#[derive(Debug, thiserror::Error)]
pub enum BuildError {
    #[error("base_url is required")]
    MissingBaseUrl,
}

impl HttpClientBuilder {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn base_url(mut self, url: impl Into<String>) -> Self {
        self.base_url = Some(url.into());
        self
    }

    pub fn timeout(mut self, duration: Duration) -> Self {
        self.timeout = Some(duration);
        self
    }

    pub fn max_retries(mut self, retries: u32) -> Self {
        self.max_retries = Some(retries);
        self
    }

    pub fn user_agent(mut self, ua: impl Into<String>) -> Self {
        self.user_agent = Some(ua.into());
        self
    }

    pub fn header(mut self, key: impl Into<String>, value: impl Into<String>) -> Self {
        self.headers.push((key.into(), value.into()));
        self
    }

    pub fn build(self) -> Result<HttpClient, BuildError> {
        Ok(HttpClient {
            base_url: self.base_url.ok_or(BuildError::MissingBaseUrl)?,
            timeout: self.timeout.unwrap_or(Duration::from_secs(30)),
            max_retries: self.max_retries.unwrap_or(3),
            user_agent: self.user_agent.unwrap_or_else(|| "my-client/1.0".into()),
            headers: self.headers,
        })
    }
}

// Usage
let client = HttpClientBuilder::new()
    .base_url("https://api.example.com")
    .timeout(Duration::from_secs(10))
    .header("Authorization", "Bearer token123")
    .build()?;
```

### 10. Newtype Pattern for Type Safety

Wrap primitive types to prevent misuse and add domain meaning:

```rust
// Without newtype: easy to swap arguments
fn send_email(from: String, to: String, subject: String) { }
send_email(to_addr, from_addr, subject); // Bug: swapped, compiles fine

// With newtype: compiler catches mistakes
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct EmailAddress(String);

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Subject(String);

impl EmailAddress {
    pub fn new(email: &str) -> Result<Self, &'static str> {
        if email.contains('@') {
            Ok(EmailAddress(email.to_string()))
        } else {
            Err("Invalid email address")
        }
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

// Implement From/Into for ergonomic conversion
impl TryFrom<&str> for EmailAddress {
    type Error = &'static str;

    fn try_from(s: &str) -> Result<Self, Self::Error> {
        EmailAddress::new(s)
    }
}

impl std::fmt::Display for EmailAddress {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

fn send_email(from: &EmailAddress, to: &EmailAddress, subject: &Subject) { }

// Now swapping from/to is a compile error
let from = EmailAddress::new("alice@example.com").unwrap();
let to = EmailAddress::new("bob@example.com").unwrap();
let subject = Subject("Hello".into());
send_email(&from, &to, &subject); // Correct

// Newtypes for numeric quantities — prevent unit confusion
#[derive(Debug, Clone, Copy, PartialEq, PartialOrd)]
pub struct Meters(f64);

#[derive(Debug, Clone, Copy, PartialEq, PartialOrd)]
pub struct Kilograms(f64);

fn calculate_bmi(height: Meters, weight: Kilograms) -> f64 {
    weight.0 / (height.0 * height.0)
}
```

## Testing

Rust has first-class support for testing built into `cargo test`.

### Unit Tests in the Same File

```rust
// src/calculator.rs

pub fn add(a: i32, b: i32) -> i32 {
    a + b
}

pub fn divide(a: f64, b: f64) -> Result<f64, &'static str> {
    if b == 0.0 {
        Err("Division by zero")
    } else {
        Ok(a / b)
    }
}

#[cfg(test)]
mod tests {
    use super::*;  // Import everything from the parent module

    #[test]
    fn test_add() {
        assert_eq!(add(2, 3), 5);
        assert_eq!(add(-1, 1), 0);
        assert_eq!(add(0, 0), 0);
    }

    #[test]
    fn test_divide_success() {
        let result = divide(10.0, 2.0).unwrap();
        assert!((result - 5.0).abs() < f64::EPSILON);
    }

    #[test]
    fn test_divide_by_zero() {
        let result = divide(10.0, 0.0);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Division by zero");
    }

    #[test]
    #[should_panic(expected = "assertion failed")]
    fn test_expected_panic() {
        assert!(1 == 2, "assertion failed");
    }

    // Return Result from tests for ? operator
    #[test]
    fn test_with_result() -> Result<(), Box<dyn std::error::Error>> {
        let result = divide(10.0, 2.0)?;
        assert_eq!(result, 5.0);
        Ok(())
    }
}
```

### Async Tests with tokio

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_async_operation() {
        let result = fetch_user_from_db(1).await;
        assert!(result.is_ok());
    }

    // Use tokio::time::pause for time-sensitive tests
    #[tokio::test]
    async fn test_timeout() {
        tokio::time::pause();

        let fut = async_operation_with_timeout();
        tokio::time::advance(std::time::Duration::from_secs(10)).await;

        let result = fut.await;
        assert!(result.is_err()); // Should have timed out
    }
}
```

### Integration Tests in `tests/`

```rust
// tests/integration_test.rs
// Only has access to public API of the crate

use my_crate::UserService;

mod common;  // Shared test helpers from tests/common/mod.rs

#[test]
fn test_create_user_end_to_end() {
    let db = common::setup_test_db();
    let service = UserService::new(db);

    let user = service.create_user("alice@example.com").unwrap();
    assert_eq!(user.email, "alice@example.com");
}
```

```rust
// tests/common/mod.rs
pub fn setup_test_db() -> TestDb {
    TestDb::in_memory().expect("Failed to create test database")
}
```

### Doc Tests

```rust
/// Parses a comma-separated string into a vector of trimmed strings.
///
/// # Examples
///
/// ```
/// use my_crate::parse_csv;
///
/// let result = parse_csv("a, b, c");
/// assert_eq!(result, vec!["a", "b", "c"]);
///
/// let empty = parse_csv("");
/// assert_eq!(empty, Vec::<String>::new());
/// ```
pub fn parse_csv(input: &str) -> Vec<String> {
    if input.is_empty() {
        return Vec::new();
    }
    input.split(',').map(|s| s.trim().to_string()).collect()
}
```

Run with `cargo test --doc`.

## Unsafe Rust Guidelines

`unsafe` unlocks operations the compiler cannot verify. Use it only when necessary.

**Acceptable uses:**
- FFI (calling C functions)
- Low-level data structures (implementing `Vec`, custom allocators)
- Hardware/OS interaction
- Performance-critical code where safe alternatives are measurably slower

```rust
// Every unsafe block MUST have a SAFETY comment explaining why it's sound
pub fn split_at_unchecked(slice: &[u8], mid: usize) -> (&[u8], &[u8]) {
    // SAFETY: The caller must guarantee that `mid <= slice.len()`.
    // We use get_unchecked to avoid the bounds check overhead in hot paths.
    unsafe {
        (
            slice.get_unchecked(..mid),
            slice.get_unchecked(mid..),
        )
    }
}

// Minimize unsafe scope — move non-unsafe code outside the block
fn process_raw(ptr: *const u8, len: usize) -> Vec<u8> {
    // Validation in safe code
    assert!(!ptr.is_null(), "ptr must not be null");
    assert!(len <= isize::MAX as usize, "len too large");

    let slice = unsafe {
        // SAFETY: ptr is non-null (checked above), len is valid (checked above),
        // and the caller guarantees the memory is initialized and valid for `len` bytes.
        std::slice::from_raw_parts(ptr, len)
    };

    // Back to safe code for processing
    slice.to_vec()
}

// Encapsulate unsafe in a safe abstraction
pub struct AlignedBuffer {
    ptr: *mut u8,
    len: usize,
}

impl AlignedBuffer {
    pub fn new(len: usize) -> Self {
        // SAFETY: Layout is valid because len > 0 and align is a power of 2.
        let layout = std::alloc::Layout::from_size_align(len, 64).unwrap();
        let ptr = unsafe { std::alloc::alloc(layout) };
        assert!(!ptr.is_null(), "allocation failed");
        AlignedBuffer { ptr, len }
    }

    // Users of AlignedBuffer never touch unsafe
    pub fn as_slice(&self) -> &[u8] {
        // SAFETY: ptr is valid and initialized during construction,
        // and self.len matches the allocated region.
        unsafe { std::slice::from_raw_parts(self.ptr, self.len) }
    }
}

impl Drop for AlignedBuffer {
    fn drop(&mut self) {
        let layout = std::alloc::Layout::from_size_align(self.len, 64).unwrap();
        // SAFETY: ptr was allocated with this same layout in `new`.
        unsafe { std::alloc::dealloc(self.ptr, layout) };
    }
}
```

## Anti-Patterns

| Anti-Pattern | Problem | Idiomatic Alternative |
|---|---|---|
| `unwrap()` in library code | Panics on user input | Return `Result<T, E>`, use `?` |
| `clone()` everywhere | Hides ownership issues, slow | Use borrows `&T`, redesign ownership |
| `Arc<Mutex<T>>` everywhere | Complex, deadlock-prone | Message passing with `mpsc`, or redesign |
| `Box<dyn Error>` in library API | Erases type info, untestable | Define `#[derive(Error)]` custom type |
| Blocking in `async fn` | Starves the runtime | Use `spawn_blocking` or async I/O |
| `unsafe` without `SAFETY` | Undocumented invariants | Always add `// SAFETY:` comment |
| `collect()` mid-chain | Unnecessary allocation | Chain iterator adaptors, collect once |
| `String` param instead of `&str` | Forces allocation at callsite | Accept `&str` or `impl AsRef<str>` |
| Mutable global state (`static mut`) | Data races, untestable | Dependency injection, `OnceLock` for init |
| `.to_string()` in hot path | Allocates on every call | Use `&str`, `Cow<str>`, or `format!` once |
| Holding `MutexGuard` across `.await` | Deadlock | Drop guard before `.await`, use `tokio::sync::Mutex` |
| `RefCell` in multi-threaded code | Compile error or panic | Use `Mutex<T>` or `RwLock<T>` |

## Quick Reference: Rust Idioms

```rust
// Option combinators
let opt: Option<i32> = Some(42);
let doubled = opt.map(|x| x * 2);            // Some(84)
let value = opt.unwrap_or(0);                // 42
let value = opt.unwrap_or_else(|| compute()); // lazy default
let chained = opt.and_then(|x| if x > 0 { Some(x) } else { None });

// Result combinators
let res: Result<i32, &str> = Ok(42);
let doubled = res.map(|x| x * 2);            // Ok(84)
let value = res.unwrap_or(0);
let mapped_err = res.map_err(|e| format!("Error: {}", e));

// Convert Option to Result
let opt: Option<i32> = None;
let res: Result<i32, &str> = opt.ok_or("value was None");

// Entry API for HashMap
use std::collections::HashMap;
let mut map: HashMap<String, Vec<i32>> = HashMap::new();
map.entry("key".into()).or_insert_with(Vec::new).push(42);

// String operations
let s = String::from("  hello world  ");
let trimmed = s.trim();
let upper = s.to_uppercase();
let replaced = s.replace("hello", "hi");
let words: Vec<&str> = s.split_whitespace().collect();

// Pattern matching
let value = 42i32;
let description = match value {
    0 => "zero",
    1..=9 => "single digit",
    10..=99 => "double digit",
    n if n < 0 => "negative",
    _ => "large",
};

// Destructuring
let (x, y, z) = (1, 2, 3);
let Point { x, y } = point;
let [first, .., last] = arr.as_slice() else { return };

// if let for single-variant matching
if let Some(value) = optional {
    println!("Got: {}", value);
}

// while let for iterative unpacking
let mut stack = vec![1, 2, 3];
while let Some(top) = stack.pop() {
    println!("{}", top);
}
```

---
title: "Composition over Inheritance: A Refactoring"
description: "An enemy hierarchy compiles cleanly until a flying archer is requested; refactor the fragile fix into injected behaviors, both versions running."
pillar: oop-design
order: 2
author: markus
published: 2026-09-22
updated: 2026-09-22
level: intermediate
tags: [oop, composition, inheritance, interfaces]
prerequisites: ["oop-design/four-pillars-of-oop"]
sources:
  - title: "Object-oriented programming: inheritance"
    url: "https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/object-oriented/inheritance"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Compiler Error CS1721"
    url: "https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/compiler-messages/cs1721"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "Design Patterns: Elements of Reusable Object-Oriented Software, chapters 1 (Inheritance versus Composition) and 5 (Strategy)"
    url: "https://www.pearson.com/en-us/subject-catalog/p/design-patterns-elements-of-reusable-object-oriented-software/P200000009480"
    publisher: "Addison-Wesley, 1994; publisher record, cited by chapter"
    accessed: 2026-09-22
  - title: "Handling and throwing exceptions in .NET"
    url: "https://learn.microsoft.com/en-us/dotnet/standard/exceptions/"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
  - title: "ArgumentOutOfRangeException Class"
    url: "https://learn.microsoft.com/en-us/dotnet/api/system.argumentoutofrangeexception"
    publisher: "Microsoft Learn"
    accessed: 2026-09-22
draft: false
---

A small dungeon game has an `Enemy` hierarchy. `Goblin` walks and hits with melee. `Archer` walks and shoots at range. Both inherit hit points and hazard damage from `Enemy` and supply only their own attack. It compiles, it runs, and it is exactly the kind of reuse inheritance is sold on: write the shared part once, vary only what differs. Then a design ticket asks for a `Wyvern` — it flies, and it attacks at range — and the hierarchy has no clean place to put it.

## The hierarchy before this week's ticket

`Enemy` owns two things every monster needs: hit points, and how crossing a hazardous tile affects them. `CrossTile` is `virtual` because a later monster might cross hazards differently; `Attack` is `abstract` because every monster must supply one. Read `TakeDamage`, `CrossTile` and the two `Attack` overrides; the array and loop above them are only a driver.

The programs on this page are complete files; on this machine, .NET 10.0.401 on Windows 11, x64, ran each one and produced the output shown under it.

```csharp run id=hierarchy
Hazard[] path =
[
    Hazard.None, Hazard.Lava,
    Hazard.None, Hazard.Lava,
    Hazard.None,
];
Enemy[] party =
[
    new Goblin("Goblin", 30),
    new Archer("Archer", 30),
    new FlyingGoblin(
        "Flying Goblin", 30),
];
foreach (var e in party)
{
    foreach (var tile in path)
        e.CrossTile(tile);
    Console.WriteLine(
        $"{e.Name,-14}hp {e.Hp,3}" +
        $"  attack {e.Attack(),2}");
}

enum Hazard { None, Lava }

abstract class Enemy(
    string name, int hp)
{
    public string Name { get; }
        = name;
    public int Hp { get; private set; }
        = hp;

    protected void TakeDamage(
        int amount)
        => Hp -= amount;

    public virtual void CrossTile(
        Hazard hazard)
    {
        if (hazard == Hazard.Lava)
            TakeDamage(10);
    }

    public abstract int Attack();
}

class Goblin(string name, int hp)
    : Enemy(name, hp)
{
    public override int Attack()
        => 8;
}

class Archer(string name, int hp)
    : Enemy(name, hp)
{
    public override int Attack()
        => 5;
}

sealed class FlyingGoblin(
    string name, int hp)
    : Goblin(name, hp)
{
    public override void CrossTile(
        Hazard hazard) { }
}
```

```text output
Goblin        hp  10  attack  8
Archer        hp  10  attack  5
Flying Goblin hp  30  attack  8
```

`FlyingGoblin` cost three lines: extend `Goblin`, override `CrossTile` to do nothing. It gets a melee `Attack` for free, because that lives in `Goblin`, and it takes no lava damage, because its override replaces the only place that damage is applied. Two lava tiles cost the ground units 20 hit points each; the flier keeps all 30. This is inheritance earning its keep — one axis of variation (does this monster fly?) layered cleanly onto another (how does it attack?) because so far only one of the two ever needed to vary at a time.

## A monster that needs two things at once

The ticket for `Wyvern` asks for `Archer`'s ranged attack and `FlyingGoblin`'s flight, together, on one class. The obvious line to write is this one:

```csharp run error=CS1721
abstract class Enemy(
    string name, int hp)
{
    public string Name { get; }
        = name;
    public int Hp { get; private set; }
        = hp;

    protected void TakeDamage(
        int amount)
        => Hp -= amount;

    public virtual void CrossTile(
        Hazard hazard)
    {
        if (hazard == Hazard.Lava)
            TakeDamage(10);
    }

    public abstract int Attack();
}

enum Hazard { None, Lava }

class Goblin(string name, int hp)
    : Enemy(name, hp)
{
    public override int Attack()
        => 8;
}

class Archer(string name, int hp)
    : Enemy(name, hp)
{
    public override int Attack()
        => 5;
}

sealed class FlyingGoblin(
    string name, int hp)
    : Goblin(name, hp)
{
    public override void CrossTile(
        Hazard hazard) { }
}

// Wyvern needs Archer's ranged
// Attack and FlyingGoblin's flight.
sealed class Wyvern(
    string name, int hp)
    : Archer(name, hp), FlyingGoblin
{
}
```

The compiler rejects it outright: `Class 'Wyvern' cannot have multiple base classes: 'Archer' and 'FlyingGoblin'`. A C# class extends exactly one other class, full stop [[1]](https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/object-oriented/inheritance); the diagnostic is CS1721 [[2]](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/compiler-messages/cs1721). This is not a style objection some linter raises — the build does not produce a program.

:::dotnet
The same class can implement any number of interfaces, even though it can extend only one class [[1]](https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/object-oriented/inheritance). That asymmetry is why the fix later in this article reaches for interfaces instead of a second base class: C# only ever blocks the *class* half of that sentence.
:::

## The fix that shipped, and the bug it planted

Under a deadline, the team keeps `Wyvern : Archer` — it needs the ranged `Attack`, and `Archer` is where that already lives — and writes a new `CrossTile` override for flight, by hand, copying `FlyingGoblin`'s body because there is no way to inherit it a second time. It works. Lava-only tests pass, because that copy is correct for the hazards that exist that week.

Weeks later, the level designers add a gas hazard that damages everyone, flying or not — altitude dodges lava, not fumes. `Enemy.CrossTile` is updated to handle it, so `Goblin` and `Archer` pick up the new rule automatically; they never overrode `CrossTile`, so there is only one copy of hazard logic to touch. `FlyingGoblin` is remembered and updated too. `Wyvern`'s copy, written in a different sprint by whoever was covering the flying-monster backlog that week, is not touched — nothing marks it as a second copy of the same idea.

```csharp run id=gas-bug
Hazard[] path =
[
    Hazard.None, Hazard.Lava,
    Hazard.Gas, Hazard.None,
    Hazard.Gas,
];
Enemy[] party =
[
    new Goblin("Goblin", 30),
    new Archer("Archer", 30),
    new FlyingGoblin(
        "Flying Goblin", 30),
    new Wyvern("Wyvern", 30),
];
foreach (var e in party)
{
    foreach (var tile in path)
        e.CrossTile(tile);
    Console.WriteLine(
        $"{e.Name,-14}hp {e.Hp,3}" +
        $"  attack {e.Attack(),2}");
}

enum Hazard { None, Lava, Gas }

abstract class Enemy(
    string name, int hp)
{
    public string Name { get; }
        = name;
    public int Hp { get; private set; }
        = hp;

    protected void TakeDamage(
        int amount)
        => Hp -= amount;

    public virtual void CrossTile(
        Hazard hazard)
    {
        if (hazard == Hazard.Lava)
            TakeDamage(10);
        if (hazard == Hazard.Gas)
            TakeDamage(6);
    }

    public abstract int Attack();
}

class Goblin(string name, int hp)
    : Enemy(name, hp)
{
    public override int Attack()
        => 8;
}

class Archer(string name, int hp)
    : Enemy(name, hp)
{
    public override int Attack()
        => 5;
}

// Updated for the gas hazard: still
// flies over lava, now also takes
// gas damage.
sealed class FlyingGoblin(
    string name, int hp)
    : Goblin(name, hp)
{
    public override void CrossTile(
        Hazard hazard)
    {
        if (hazard == Hazard.Gas)
            TakeDamage(6);
    }
}

// Nobody remembered this copy.
// It still only knows about lava.
sealed class Wyvern(
    string name, int hp)
    : Archer(name, hp)
{
    public override void CrossTile(
        Hazard hazard) { }
}
```

```text output
Goblin        hp   8  attack  8
Archer        hp   8  attack  5
Flying Goblin hp  18  attack  8
Wyvern        hp  30  attack  5
```

`Flying Goblin` and `Wyvern` are both flying units crossing the same path; a correct simulation makes them lose the same 12 hit points to the two gas tiles and nothing to lava. `Flying Goblin` does. `Wyvern` shows full health. Nothing threw, nothing logged a warning — the number is just wrong, and it stays wrong until a playtester notices Wyverns are unkillable in a gas cloud or a designer wonders why the damage spreadsheet disagrees with the game.

::::exercise[Does a cast change the answer?]
Before running anything, decide: if the code held the same `Wyvern` object through a variable declared `Archer` instead of `Wyvern`, and called `CrossTile(Hazard.Gas)` on it twice, would the gas damage still fail to apply? What if the variable were declared `Enemy`?

:::solution
Neither declaration changes anything. `CrossTile` is `virtual`, so a call through it always runs the method belonging to the object's actual run-time type — `Wyvern`'s override — no matter what the compile-time type of the reference says. That is the entire point of `virtual`, and it is also why the bug cannot be caught by being more careful about which type you hold: there is no reference type that reaches the base class's gas handling once `Wyvern` has overridden `CrossTile`.

```csharp run
Archer viaArcher =
    new Wyvern("Wyvern", 30);
Enemy viaEnemy = viaArcher;

viaArcher.CrossTile(Hazard.Gas);
Console.WriteLine(
    $"after 1 gas: hp {viaEnemy.Hp}");
viaEnemy.CrossTile(Hazard.Gas);
Console.WriteLine(
    $"after 2 gas: hp {viaEnemy.Hp}");

enum Hazard { None, Lava, Gas }

abstract class Enemy(
    string name, int hp)
{
    public string Name { get; }
        = name;
    public int Hp { get; private set; }
        = hp;

    protected void TakeDamage(
        int amount)
        => Hp -= amount;

    public virtual void CrossTile(
        Hazard hazard)
    {
        if (hazard == Hazard.Lava)
            TakeDamage(10);
        if (hazard == Hazard.Gas)
            TakeDamage(6);
    }

    public abstract int Attack();
}

class Archer(string name, int hp)
    : Enemy(name, hp)
{
    public override int Attack()
        => 5;
}

sealed class Wyvern(
    string name, int hp)
    : Archer(name, hp)
{
    public override void CrossTile(
        Hazard hazard) { }
}
```

```text output
after 1 gas: hp 30
after 2 gas: hp 30
```
:::
::::

<figure class="diagram">
<svg viewBox="0 0 360 320" role="img" aria-labelledby="coi1-title coi1-desc">
<title id="coi1-title">The Enemy hierarchy when Wyvern was requested</title>
<desc id="coi1-desc">Enemy is the base class with a virtual CrossTile and an abstract Attack. Goblin and Archer both extend Enemy. FlyingGoblin extends Goblin and overrides CrossTile to skip lava. Under Archer, a box shows the rejected attempt to also extend FlyingGoblin, marked CS1721. Below it, the Wyvern class that shipped instead extends only Archer and repeats FlyingGoblin's override by hand, the same fix living in two places.</desc>
<defs>
<marker id="coi1-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-stroke"/></marker>
</defs>
<rect x="90" y="10" width="180" height="46" rx="6" class="d-box-accent"/>
<text x="180" y="29" text-anchor="middle" class="d-bold">Enemy</text>
<text x="180" y="45" text-anchor="middle" class="d-small d-mono">CrossTile, Attack</text>
<path d="M140 56 V80" class="d-line" marker-end="url(#coi1-arrow)"/>
<path d="M220 56 V80" class="d-line" marker-end="url(#coi1-arrow)"/>
<rect x="20" y="84" width="140" height="40" rx="6" class="d-box"/>
<text x="90" y="103" text-anchor="middle" class="d-bold">Goblin</text>
<text x="90" y="118" text-anchor="middle" class="d-small d-muted">melee</text>
<rect x="200" y="84" width="140" height="40" rx="6" class="d-box"/>
<text x="270" y="103" text-anchor="middle" class="d-bold">Archer</text>
<text x="270" y="118" text-anchor="middle" class="d-small d-muted">ranged</text>
<path d="M90 124 V150" class="d-line" marker-end="url(#coi1-arrow)"/>
<path d="M270 124 V150" class="d-line" marker-end="url(#coi1-arrow)"/>
<rect x="20" y="154" width="140" height="50" rx="6" class="d-box-2"/>
<text x="90" y="172" text-anchor="middle" class="d-bold">FlyingGoblin</text>
<text x="90" y="188" text-anchor="middle" class="d-small">skip lava</text>
<text x="90" y="200" text-anchor="middle" class="d-small d-muted">(override)</text>
<rect x="200" y="154" width="140" height="64" rx="6" class="d-box-bad"/>
<text x="270" y="171" text-anchor="middle" class="d-small d-bold">tried both bases</text>
<text x="270" y="187" text-anchor="middle" class="d-mono d-small">+ FlyingGoblin</text>
<text x="270" y="205" text-anchor="middle" class="d-text-bad d-small d-bold">CS1721: rejected</text>
<text x="90" y="224" text-anchor="middle" class="d-small d-muted">same fix as Wyvern,</text>
<text x="90" y="238" text-anchor="middle" class="d-small d-muted">copied below</text>
<path d="M270 218 V244" class="d-line" marker-end="url(#coi1-arrow)"/>
<rect x="200" y="248" width="140" height="58" rx="6" class="d-box-warn"/>
<text x="270" y="266" text-anchor="middle" class="d-bold">Wyvern</text>
<text x="270" y="282" text-anchor="middle" class="d-small">extends Archer</text>
<text x="270" y="298" text-anchor="middle" class="d-small d-muted">flies: code copied</text>
</svg>
<figcaption>Figure 1. Wyvern needs Archer's ranged attack and FlyingGoblin's flight. C# will not let it extend both, so the shipped class extends Archer and repeats FlyingGoblin's override by hand.</figcaption>
</figure>

## Why the duplication wasn't bad luck

A reasonable first reaction is that the team should simply have factored "skip lava, take gas" into a shared `static` helper and called it from both overrides. That removes *this* duplication. It does not remove the underlying constraint: the next flying attacker still has to be declared as extending whichever existing class supplies its attack, its `CrossTile` override still has to remember to call the helper, and a third independent trait — say, a monster immune to being frozen — runs into the same one-base-class ceiling again. Helpers reduce how much code is copied; they do not change how many places remember to call it.

The root cause is that `CrossTile` (how it moves) and `Attack` (how it fights) are independent choices, and inheritance can only model one chain of "is more specific than." Pick movement as the chain, and every attack style needs restating per movement; pick attack as the chain, as the team did, and every movement style needs restating per attack. Two ground attackers and two flying attackers is only four classes here, but that is because this game currently has exactly two values on each axis. A third movement (swimming) or a third attack (a magic bolt) does not add one class — it multiplies the count of classes that would be needed to cover every combination by subclassing alone.

This is precisely the caution behind Gamma, Helm, Johnson and Vlissides's well-known advice in *Design Patterns*: "Favor object composition over class inheritance" [[3]](https://www.pearson.com/en-us/subject-catalog/p/design-patterns-elements-of-reusable-object-oriented-software/P200000009480). Their point is not that inheritance is wrong; `FlyingGoblin` reusing `Goblin`'s melee attack for free was inheritance working exactly as intended, for one axis. It is that reuse across two independent axes belongs to objects you assemble, not to a chain of classes you extend.

## Behaviors as objects the enemy holds, not base classes it extends

Movement and attack become interfaces. `Enemy` stops being a hierarchy and becomes one `sealed` class that holds one of each, supplied through its constructor:

```csharp run id=composed
Hazard[] path =
[
    Hazard.None, Hazard.Lava,
    Hazard.Gas, Hazard.None,
    Hazard.Gas,
];

var walking = new Walking();
var flying = new Flying();
Enemy[] party =
[
    new("Goblin", 30,
        walking, new Melee(8)),
    new("Archer", 30,
        walking, new Ranged(5)),
    new("Flying Goblin", 30,
        flying, new Melee(8)),
    new("Wyvern", 30,
        flying, new Ranged(5)),
];

foreach (var e in party)
{
    foreach (var tile in path)
        e.CrossTile(tile);
    Console.WriteLine(
        $"{e.Name,-14}hp {e.Hp,3}" +
        $"  attack {e.Attack(),2}");
}

enum Hazard { None, Lava, Gas }

interface IMovement
{
    int DamageFor(Hazard hazard);
}

sealed class Walking : IMovement
{
    public int DamageFor(
        Hazard hazard) => hazard switch
    {
        Hazard.Lava => 10,
        Hazard.Gas => 6,
        _ => 0,
    };
}

sealed class Flying : IMovement
{
    public int DamageFor(
        Hazard hazard) => hazard switch
    {
        Hazard.Gas => 6,
        _ => 0,
    };
}

interface IAttack
{
    int Damage { get; }
}

sealed class Melee(int damage)
    : IAttack
{
    public int Damage { get; }
        = damage;
}

sealed class Ranged(int damage)
    : IAttack
{
    public int Damage { get; }
        = damage;
}

sealed class Enemy(
    string name, int hp,
    IMovement movement,
    IAttack attack)
{
    public string Name { get; }
        = name;
    public int Hp { get; private set; }
        = hp;
    public int Attack()
        => attack.Damage;

    public void CrossTile(
        Hazard hazard)
        => Hp -=
            movement.DamageFor(hazard);
}
```

```text output
Goblin        hp   8  attack  8
Archer        hp   8  attack  5
Flying Goblin hp  18  attack  8
Wyvern        hp  18  attack  5
```

`Wyvern` now takes 18, matching `Flying Goblin` exactly, because the `flying` object handed to both of them is the same `Flying` instance running the same code. There is no `Wyvern` class to forget to update, because there is no override to duplicate — `Flying.DamageFor` is the only place gas-versus-lava logic for flying units exists. `Goblin` and `Archer` differ from each other only in which `IAttack` they hold; `Flying Goblin` and `Wyvern` differ from each other the same way. Movement and attack vary independently because they are now two independently swappable objects instead of one chain of classes trying to encode both.

Two things worth naming here, because you will meet both again under their own labels: a class that holds an interchangeable behavior object instead of implementing that behavior itself is applying the Strategy pattern, and handing that object to the constructor instead of letting `Enemy` construct it itself is dependency injection — the same move [`Collector(IPaymentGateway gateway)`](/oop-design/four-pillars-of-oop/#how-is-abstraction-different-from-encapsulation) makes in the prerequisite article for this one, just for behavior rather than an outside service.

:::pitfall
Sharing one `Flying` instance between `Flying Goblin` and `Wyvern` is safe only because `Flying`, `Walking`, `Melee` and `Ranged` hold no mutable state — each `Damage` and `DamageFor` computation depends only on its arguments and the constructor values fixed at creation. An injected behavior object that instead tracked something per-battle, such as a cooldown counter, would leak that state between every `Enemy` it was handed to, the same way two callers writing through the same shared list would step on each other. Composition trades away the base-class coupling this article opened with; it does not remove the ordinary rule that shared mutable objects need their sharing to be deliberate.
:::

::::exercise[Add a third movement without touching a line above it]
The level design team wants a `Siren`: it swims (immune to gas, takes lava damage like a walker) and attacks at range. Using only `IMovement`, `IAttack`, `Enemy` and the classes already defined, add it. You should not need to change `Enemy`, `Walking`, `Flying`, `Melee` or `Ranged`.

:::solution
A new movement is a new class implementing `IMovement`; nothing else moves.

```csharp run
Hazard[] path =
[
    Hazard.None, Hazard.Lava,
    Hazard.Gas, Hazard.None,
    Hazard.Gas,
];

var siren = new Enemy(
    "Siren", 30,
    new Swimming(), new Ranged(7));
foreach (var tile in path)
    siren.CrossTile(tile);
Console.WriteLine(
    $"{siren.Name,-14}hp {siren.Hp,3}" +
    $"  attack {siren.Attack(),2}");

enum Hazard { None, Lava, Gas }

interface IMovement
{
    int DamageFor(Hazard hazard);
}

sealed class Swimming : IMovement
{
    public int DamageFor(
        Hazard hazard) => hazard switch
    {
        Hazard.Lava => 10,
        _ => 0,
    };
}

interface IAttack
{
    int Damage { get; }
}

sealed class Ranged(int damage)
    : IAttack
{
    public int Damage { get; }
        = damage;
}

sealed class Enemy(
    string name, int hp,
    IMovement movement,
    IAttack attack)
{
    public string Name { get; }
        = name;
    public int Hp { get; private set; }
        = hp;
    public int Attack()
        => attack.Damage;

    public void CrossTile(
        Hazard hazard)
        => Hp -=
            movement.DamageFor(hazard);
}
```

```text output
Siren         hp  20  attack  7
```

`Siren` reuses `Ranged` unchanged and adds one class, `Swimming`. Under the old hierarchy, a swimming archer would have hit the same wall `Wyvern` did: `Archer` already supplies the ranged attack, and there is still no second base class available for the swimming behavior.
:::
::::

<figure class="diagram">
<svg viewBox="0 0 360 350" role="img" aria-labelledby="coi2-title coi2-desc">
<title id="coi2-title">The composed design after the refactor</title>
<desc id="coi2-desc">A single sealed Enemy class holds a movement object and an attack object, both interfaces. IMovement has two implementations, Walking and Flying. IAttack has two implementations, Melee and Ranged. Below, four enemies are listed as combinations of one movement object and one attack object each. Flying Goblin and Wyvern both use the same Flying object, highlighted, so fixing a hazard rule in Flying fixes both at once.</desc>
<defs>
<marker id="coi2-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-accent"/></marker>
<marker id="coi2-arrow-n" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="d-fill-stroke"/></marker>
</defs>
<rect x="100" y="10" width="160" height="50" rx="6" class="d-box-accent"/>
<text x="180" y="30" text-anchor="middle" class="d-bold">Enemy (sealed)</text>
<text x="180" y="47" text-anchor="middle" class="d-small d-mono">movement, attack</text>
<path d="M150 60 L95 84" class="d-accent" marker-end="url(#coi2-arrow)"/>
<text x="70" y="78" text-anchor="middle" class="d-text-accent d-small">has a</text>
<path d="M210 60 L265 84" class="d-accent" marker-end="url(#coi2-arrow)"/>
<text x="290" y="78" text-anchor="middle" class="d-text-accent d-small">has a</text>
<rect x="15" y="88" width="160" height="34" rx="6" class="d-box"/>
<text x="95" y="110" text-anchor="middle" class="d-mono d-bold">IMovement</text>
<rect x="185" y="88" width="160" height="34" rx="6" class="d-box"/>
<text x="265" y="110" text-anchor="middle" class="d-mono d-bold">IAttack</text>
<path d="M55 148 V126" class="d-line" marker-end="url(#coi2-arrow-n)"/>
<path d="M135 148 V126" class="d-line" marker-end="url(#coi2-arrow-n)"/>
<path d="M225 148 V126" class="d-line" marker-end="url(#coi2-arrow-n)"/>
<path d="M305 148 V126" class="d-line" marker-end="url(#coi2-arrow-n)"/>
<rect x="20" y="150" width="70" height="34" rx="6" class="d-box-2"/>
<text x="55" y="172" text-anchor="middle" class="d-small d-bold">Walking</text>
<rect x="100" y="150" width="70" height="34" rx="6" class="d-box-accent"/>
<text x="135" y="172" text-anchor="middle" class="d-small d-bold">Flying</text>
<rect x="190" y="150" width="70" height="34" rx="6" class="d-box-2"/>
<text x="225" y="172" text-anchor="middle" class="d-small d-bold">Melee</text>
<rect x="270" y="150" width="70" height="34" rx="6" class="d-box-2"/>
<text x="305" y="172" text-anchor="middle" class="d-small d-bold">Ranged</text>
<text x="20" y="212" class="d-small d-bold">Four enemies, one pair each:</text>
<text x="20" y="230" class="d-mono d-small">Goblin  = Walking+Melee</text>
<text x="20" y="246" class="d-mono d-small">Archer  = Walking+Ranged</text>
<rect x="14" y="256" width="332" height="44" rx="6" class="d-box-accent"/>
<text x="20" y="272" class="d-mono d-small">FlyingGoblin = Flying+Melee</text>
<text x="20" y="290" class="d-mono d-small">Wyvern       = Flying+Ranged</text>
<text x="20" y="318" class="d-small d-text-accent">Both rows use the same</text>
<text x="20" y="334" class="d-small d-text-accent">Flying object: one fix, not two.</text>
</svg>
<figcaption>Figure 2. Movement and attack are objects Enemy holds, not classes it extends. Flying Goblin and Wyvern share one Flying instance, so a hazard rule lives in exactly one place.</figcaption>
</figure>

## When inheritance is still the right call

None of this makes inheritance the wrong tool in general — it means inheritance is the wrong tool when a type needs to vary along two or more independent axes at once. .NET's own exception types are a case where it is exactly right, and the contrast is worth making concrete. `ArgumentOutOfRangeException` inherits from `ArgumentException`, which inherits from `SystemException`, which inherits from `Exception` [[5]](https://learn.microsoft.com/en-us/dotnet/api/system.argumentoutofrangeexception). Catching `ArgumentException` catches every argument problem without listing each one:

```csharp run id=exceptions
Show(name: null, seats: 5);
Show(name: "Team plan", seats: -2);
Show(name: "Team plan", seats: 5);

static void Show(string? name, int seats)
{
    try
    {
        Validate(name, seats);
        Console.WriteLine(
            $"{name}, {seats}: ok");
    }
    catch (ArgumentException e)
    {
        Console.WriteLine(
            $"rejected: {e.GetType().Name}");
    }
}

static void Validate(
    string? name, int seats)
{
    ArgumentException
        .ThrowIfNullOrWhiteSpace(name);
    ArgumentOutOfRangeException
        .ThrowIfNegative(seats);
}
```

```text output
rejected: ArgumentNullException
rejected: ArgumentOutOfRangeException
Team plan, 5: ok
```

Two things hold here that never held for `Wyvern`. First, an exception varies along exactly one axis — what kind of problem occurred — so there is only ever one hierarchy for a new exception type to fit into, never two independent ones to merge; nothing plays the role `Wyvern` played, needing to be a full member of two branches simultaneously. Second, the base class is not a design choice you are free to swap for an interface the way `Enemy` swapped its axes for `IMovement` and `IAttack`: in .NET, every object you throw is required to inherit from `System.Exception` [[4]](https://learn.microsoft.com/en-us/dotnet/standard/exceptions/). `throw` and `catch` are matched against that inheritance chain by the runtime itself; there is no injected-interface alternative to reach for, because the language does not offer `throw` anything that only implements one. Composition is not a live option here, and inheritance costs nothing extra, because there is no second axis for it to collide with.

::::exercise[How many classes does each design need?]
This game has 2 movement kinds and 2 attack kinds today. Suppose it grows to `M` movement kinds and `A` attack kinds, and every combination is a real, playable monster.

1. Under full subclassing — a distinct class for every combination, the way `Wyvern` was forced to sit under `Archer` — how many classes cover every combination, in terms of `M` and `A`?
2. Under the composed design in this article, how many classes does full coverage need?
3. Design adds a third attack kind partway through development. How many *new* classes does each design need to keep covering every movement paired with it?

:::solution
1. Up to `M × A`: one class per combination, because each one has to pick a single position in a single chain of "extends."
2. `M + A`: one `IMovement` implementation per movement kind, one `IAttack` implementation per attack kind, and every combination already exists as a constructor call, not a class.
3. Full subclassing needs `M` new classes, one per existing movement kind crossed with the new attack. The composed design needs exactly 1: a new `IAttack` implementation, usable immediately by every existing `IMovement` and by any future one, with no change to `Enemy`, `Walking`, `Flying`, or any monster already shipped.

With this game's current `M = 2, A = 2`, subclassing and composition tie at 4 classes each — which is exactly why the difference was invisible until the second requirement arrived. The gap opens as soon as either axis grows past two values, and it opens fastest on the axis nobody has needed to extend yet.
:::
::::

// Dealing: which cards a round gets, and in which order (spec section 6, "Dealing").
// A line-by-line port of src/engine/deal.ts. The only source of chance is the rng passed in.
package com.eienmosu.truthy.engine

import kotlin.math.ceil
import kotlin.math.floor

/** The rules of a deal, per ten cards: at most three missed cards, four to six True cards, runs of at most three. */
data class DealConstants(val missedPerTen: Int, val minTrue: Int, val maxTrue: Int, val maxRun: Int)

val DEAL: DealConstants = DealConstants(missedPerTen = 3, minTrue = 4, maxTrue = 6, maxRun = 3)

data class DealOptions(
    val count: Double, // how many cards to deal (a Double, as in the TypeScript: NaN, 4.7 and -3 have pinned results)
    val avoid: List<Card>? = null, // cards whose conflict groups must not be repeated
    val before: List<Boolean>? = null, // the answers of the cards dealt just before this deal, oldest first
    val budget: Double? = null, // the steps one search may take, SEARCH_BUDGET unless a test sets another
)

fun deal(pool: List<Card>, history: History, rng: Rng, options: DealOptions): List<Card> {
    val cards = uniqueById(pool)
    val size = dealSize(options.count, cards.size)
    if (size == 0) return emptyList()
    return dealRanked(
        rankByPriority(cards, history, rng, size),
        size,
        rng,
        Setting(avoid = options.avoid, before = options.before, budget = options.budget),
    )
}

// How a deal is chosen beyond its cards: the conflict groups to keep clear of, the answers just before it,
// the bound on the search and whether an unshown card is overdue (dealChunk only).
internal data class Setting(
    val avoid: List<Card>? = null,
    val before: List<Boolean>? = null,
    val budget: Double? = null,
    val overdue: Boolean? = null,
)

// Chooses `size` cards from a ranking and puts them in order.
internal fun dealRanked(ranking: Ranking, size: Int, rng: Rng, setting: Setting): List<Card> {
    val chosen = choose(ranking, size, setting.avoid ?: emptyList(), setting.budget ?: SEARCH_BUDGET, setting.overdue ?: false)
    return arrange(chosen, rng, joinOf(setting.before ?: emptyList()))
}

// Where a deal joins the cards before it: their last answer and the length of the run of equal answers
// that ends them. Nothing before: no last answer, no run.
internal data class Join(val last: Boolean?, val run: Int)

internal fun joinOf(before: List<Boolean>): Join {
    val last = before.lastOrNull()
    var run = 0
    var i = before.size - 1
    while (i >= 0 && before[i] == last) {
        run += 1
        i -= 1
    }
    return Join(last = last, run = run)
}

const val CHUNK: Int = 10

// The next cards of a round, given every card the round has dealt so far (in order): ten, or as many as
// may be dealt. First in line are the cards the round has not shown, ranked by the stored history. Behind
// them stand the cards it may bring back: every card outside the last min(CHUNK, route size - 1) dealt,
// the one shown longest ago first. A card still unshown once the round has dealt the route twice over is
// overdue: the chunk then takes one unshown card even if a rule has to give way for it (see choose).
fun dealChunk(pool: List<Card>, history: History, rng: Rng, dealt: List<Card>, budget: Double = SEARCH_BUDGET): List<Card> {
    val cards = uniqueById(pool)
    val lastDealtAt = HashMap<String, Int>()
    dealt.forEachIndexed { position, card -> lastDealtAt[card.id] = position }
    val unshown = cards.filter { it.id !in lastDealtAt }
    val gap = minOf(CHUNK, cards.size - 1)
    val comeBack = cards
        .filter { (lastDealtAt[it.id] ?: dealt.size) < dealt.size - gap }
        .sortedBy { lastDealtAt[it.id] ?: 0 } // distinct Int positions: no ties, no -0
    val size = minOf(CHUNK, unshown.size + comeBack.size)
    val lastTen = dealt.takeLast(CHUNK)
    return dealRanked(
        rankByPriority(unshown, history, rng, size).copy(comeBack = comeBack),
        size,
        rng,
        Setting(
            avoid = lastTen,
            before = lastTen.map { it.answer },
            budget = budget,
            overdue = unshown.isNotEmpty() && dealt.size >= OVERDUE_AFTER_PASSES * cards.size,
        ),
    )
}

// How many times a round deals the whole route before a card it has not shown is overdue.
internal const val OVERDUE_AFTER_PASSES: Int = 2

// The first card with each id wins, so a card can never be dealt twice.
internal fun uniqueById(pool: List<Card>): List<Card> {
    val seen = HashSet<String>()
    return pool.filter { seen.add(it.id) }
}

internal fun dealSize(count: Double, available: Int): Int {
    if (count.isNaN() || count <= 0.0) return 0
    return minOf(floor(count), available.toDouble()).toInt()
}

internal fun wasSeen(card: Card, history: History): Boolean {
    val entry = history[card.id] ?: return false
    return entry.seen > 0
}

internal fun wasMissed(card: Card, history: History): Boolean =
    wasSeen(card, history) && history[card.id]?.lastCorrect == false

internal fun lastSeenAt(card: Card, history: History): Double {
    val at = history[card.id]?.lastSeenAt
    return if (at != null && at.isFinite()) at else 0.0
}

// Ascending by key; equal keys keep their order through a position tiebreak (spec 4.4). The keys are subtracted
// and the difference compared with 0.0 on Double, IEEE style, so -0.0 and 0.0 are equal keys, as `a - b` is 0
// for them in the TypeScript. Double.compareTo would put -0.0 first.
internal fun stableSorted(cards: List<Card>, key: (Card) -> Double): List<Card> {
    val keys: List<Double> = cards.map(key)
    val order = cards.indices.sortedWith(
        Comparator { a: Int, b: Int ->
            val difference: Double = keys[a] - keys[b]
            when {
                difference < 0.0 -> -1
                difference > 0.0 -> 1
                else -> a.compareTo(b)
            }
        },
    )
    return order.map { cards[it] }
}

// Oldest first; equal keys keep their (shuffled) order.
internal fun oldestFirst(cards: List<Card>, history: History): List<Card> =
    stableSorted(cards) { lastSeenAt(it, history) }

// The pool in the order cards should be considered: missed cards up to the cap (oldest miss first),
// never seen (shuffled), seen longest ago. The missed cards over the cap are kept apart.
internal data class Ranking(
    val withinCap: List<Card>,
    val overCap: List<Card>,
    val comeBack: List<Card>, // dealChunk only: cards the round has shown and may bring back, the one shown longest ago first
    val missed: Set<String>, // the ids of the missed cards among withinCap and overCap
    val missedCap: Int, // how many missed cards a deal of this size holds at most, unless the rules need more
)

internal fun rankByPriority(cards: List<Card>, history: History, rng: Rng, size: Int): Ranking {
    val shuffled = shuffle(cards, rng)
    val missed = oldestFirst(shuffled.filter { wasMissed(it, history) }, history)
    val unseen = shuffled.filter { !wasSeen(it, history) }
    val seenRight = oldestFirst(shuffled.filter { wasSeen(it, history) && !wasMissed(it, history) }, history)
    val missedCap = floor(size * DEAL.missedPerTen / 10.0).toInt()
    return Ranking(
        withinCap = missed.take(missedCap) + unseen + seenRight,
        overCap = missed.drop(missedCap),
        comeBack = emptyList(),
        missed = missed.mapTo(LinkedHashSet()) { it.id },
        missedCap = missedCap,
    )
}

// How many True cards a deal of `size` may have: 4 to 6 per ten, scaled (floor of 40%, ceiling of 60%).
internal data class Balance(val minTrue: Int, val maxTrue: Int)

internal fun balanceFor(size: Int): Balance =
    Balance(
        minTrue = floor(size * DEAL.minTrue / 10.0).toInt(),
        maxTrue = ceil(size * DEAL.maxTrue / 10.0).toInt(),
    )

// Picks `size` cards, relaxing the rules in the order of the spec only as far as needed:
// 1. every rule, without the missed cards over the cap; 2. the missed cards over the cap (searchOverCap);
// 3. a card the round has shown may come back; 4. conflict groups, then 5. answer balance (relaxStepByStep).
// When an unshown card is overdue and the chunk holds none, the first unshown card goes in and the
// fallback relaxes the rest of the chunk around it.
internal fun choose(ranking: Ranking, size: Int, avoid: List<Card>, budget: Double, overdue: Boolean): List<Card> {
    val balance = balanceFor(size)
    val unshown = ranking.withinCap + ranking.overCap
    val everyCard = unshown + ranking.comeBack
    val search: (List<Card>, Limits) -> List<Card>? = { ranked, limits ->
        searchWithAllRules(
            ranked, size, avoid, balance,
            Limits(
                budget = limits.budget ?: budget,
                missed = limits.missed ?: ranking.missed,
                missedLimit = limits.missedLimit,
            ),
        )
    }
    val chosen = search(ranking.withinCap, Limits())
        ?: searchOverCap(ranking, unshown, search)
        ?: (if (ranking.comeBack.isNotEmpty()) search(everyCard, Limits()) else null)
        ?: relaxStepByStep(everyCard, size, avoid, balance)
    val unshownIds = unshown.mapTo(HashSet()) { it.id }
    if (!overdue || chosen.any { it.id in unshownIds }) return chosen
    return relaxStepByStep(everyCard, size, avoid, balance, unshown.take(1))
}

// Step 2. A deal that keeps the missed cards within the cap comes before a deal over it; over the cap, the
// fewer missed cards the better. The limits tried run from the cap up to one below what the loosest deal holds.
internal fun searchOverCap(ranking: Ranking, unshown: List<Card>, search: (List<Card>, Limits) -> List<Card>?): List<Card>? {
    if (ranking.overCap.isEmpty()) return null // the same cards as step 1, which found nothing
    val loosest = search(unshown, Limits()) ?: return null
    val held = loosest.count { it.id in ranking.missed }
    for (limit in ranking.missedCap until held) {
        val found = search(unshown, Limits(missedLimit = limit))
        if (found != null) return found
    }
    return loosest
}

// A bound on the work one search may do (a Double, so that a test can pass Infinity as the web's does).
const val SEARCH_BUDGET: Double = 20_000.0

// What else a search must keep to: the steps it may take, and at most `missedLimit` of the `missed` cards.
// A null missedLimit is the TypeScript's Infinity.
internal data class Limits(val budget: Double? = null, val missed: Set<String>? = null, val missedLimit: Int? = null)

// Depth-first over the ranked cards: at each card, first try to take it, then try to leave it out.
// Returns null when no deal keeps both the conflict groups and the balance (or the search ran out of steps).
internal fun searchWithAllRules(
    ranked: List<Card>,
    size: Int,
    avoid: List<Card>,
    balance: Balance,
    limits: Limits = Limits(),
): List<Card>? {
    val usedGroups = HashSet<String>()
    for (card in avoid) usedGroups.addAll(card.conflictGroups)
    val picked = ArrayList<Card>()
    val missed = limits.missed ?: emptySet()
    val missedLimit = limits.missedLimit ?: Int.MAX_VALUE // Int.MAX_VALUE stands for Infinity: nothing below overflows with it
    var trues = 0
    var missedTaken = 0
    var budget = limits.budget ?: SEARCH_BUDGET

    fun isMissed(card: Card): Boolean = card.id in missed

    fun canTake(card: Card): Boolean =
        card.conflictGroups.none { it in usedGroups } &&
            !(isMissed(card) && missedTaken >= missedLimit) &&
            balanceAllows(card.answer, trues, picked.size - trues, size, balance)

    fun take(card: Card) {
        picked.add(card)
        if (card.answer) trues += 1
        if (isMissed(card)) missedTaken += 1
        usedGroups.addAll(card.conflictGroups)
    }

    // A card is only taken when none of its groups is in use, so removing them on the way back is safe.
    fun putBack(card: Card) {
        picked.removeAt(picked.size - 1)
        if (card.answer) trues -= 1
        if (isMissed(card)) missedTaken -= 1
        usedGroups.removeAll(card.conflictGroups.toSet())
    }

    // Whether ranked[from..] can still fill the deal: an upper bound on what those cards can add.
    fun canStillFinish(from: Int): Boolean {
        val loose = IntArray(2) // cards with no group, by answer (0 False, 1 True)
        val grouped = IntArray(2) // cards with groups, by answer
        val groupsOf = arrayOf(HashSet<String>(), HashSet<String>())
        val allGroups = HashSet<String>()
        var takeable = 0
        var missedLeft = 0
        for (i in from until ranked.size) {
            val card = ranked[i]
            if (card.conflictGroups.any { it in usedGroups }) continue
            val answer = if (card.answer) 1 else 0
            takeable += 1
            if (isMissed(card)) missedLeft += 1
            if (card.conflictGroups.isEmpty()) {
                loose[answer] += 1
                continue
            }
            grouped[answer] += 1
            for (group in card.conflictGroups) {
                groupsOf[answer].add(group)
                allGroups.add(group)
            }
        }
        val need = size - picked.size
        val falses = picked.size - trues
        val cardsLeft = loose[0] + loose[1] + minOf(grouped[0] + grouped[1], allGroups.size)
        val withinMissedLimit = takeable - maxOf(0, missedLeft - (missedLimit - missedTaken))
        val truesLeft = minOf(loose[1] + minOf(grouped[1], groupsOf[1].size), balance.maxTrue - trues)
        val falsesLeft = minOf(loose[0] + minOf(grouped[0], groupsOf[0].size), size - balance.minTrue - falses)
        return minOf(cardsLeft, withinMissedLimit, truesLeft + falsesLeft) >= need
    }

    fun visit(from: Int): Boolean {
        if (picked.size == size) return true
        val left = budget
        budget -= 1.0
        if (left <= 0.0 || !canStillFinish(from)) return false
        val card = ranked.getOrNull(from) ?: return false
        if (canTake(card)) {
            take(card)
            if (visit(from + 1)) return true
            putBack(card)
        }
        return visit(from + 1)
    }

    return if (visit(0)) picked.toList() else null
}

internal data class Rules(
    val conflicts: Boolean, // keep conflict groups apart (within the deal and against `avoid`)
    val balance: Boolean, // keep the number of True cards inside the balance
)

// The fallback when no deal keeps every rule. Three passes over the ranked cards, each adding to the cards
// already picked (`first`, if given): all rules, then without conflict groups, then without the balance.
internal fun relaxStepByStep(
    ranked: List<Card>,
    size: Int,
    avoid: List<Card>,
    balance: Balance,
    first: List<Card> = emptyList(),
): List<Card> {
    val picked = ArrayList(first)
    val pickedIds = first.mapTo(HashSet()) { it.id }

    fun breaks(card: Card, rules: Rules): Boolean {
        if (rules.conflicts && sharesGroup(card, avoid + picked)) return true
        if (!rules.balance) return false
        val trues = trueCount(picked)
        return !balanceAllows(card.answer, trues, picked.size - trues, size, balance)
    }

    fun fill(rules: Rules) {
        for (card in ranked) {
            if (picked.size == size) return
            if (card.id in pickedIds || breaks(card, rules)) continue
            picked.add(card)
            pickedIds.add(card.id)
        }
    }

    fill(Rules(conflicts = true, balance = true))
    fill(Rules(conflicts = false, balance = true))
    fill(Rules(conflicts = false, balance = false))
    return picked.toList()
}

internal fun sharesGroup(card: Card, others: List<Card>): Boolean =
    card.conflictGroups.any { group -> others.any { other -> group in other.conflictGroups } }

internal fun trueCount(cards: List<Card>): Int = cards.count { it.answer }

// True cards may not pass maxTrue, and False cards may not pass size - minTrue,
// so a full deal picked under this rule always lands inside the balance.
internal fun balanceAllows(answer: Boolean, trues: Int, falses: Int, size: Int, balance: Balance): Boolean =
    if (answer) trues < balance.maxTrue else falses < size - balance.minTrue

// Puts the chosen cards in an order drawn from the rng with no run of equal answers longer than the run limit.
// Position by position, it draws True or False in proportion to how many of each are left, among the answers
// that still allow the rest to be placed; then it takes the next card of that answer.
internal fun arrange(chosen: List<Card>, rng: Rng, join: Join): List<Card> {
    val trues = shuffle(chosen.filter { it.answer }, rng).toMutableList()
    val falses = shuffle(chosen.filter { !it.answer }, rng).toMutableList()
    val limit = runLimit(trues.size, falses.size, join)
    val canPlace = placementCheck(limit)
    val order = ArrayList<Card>()
    var last: Boolean? = join.last
    var run = join.run

    while (trues.size + falses.size > 0) {
        val allowed = listOf(true, false).filter { answer ->
            val left = if (answer) trues.size else falses.size
            if (left == 0 || (answer == last && run >= limit)) {
                false
            } else {
                val nextRun = if (answer == last) run + 1 else 1
                canPlace(trues.size - (if (answer) 1 else 0), falses.size - (if (answer) 0 else 1), answer, nextRun)
            }
        }
        val answer = pickAnswer(allowed, trues.size, falses.size, rng)
        val pile = if (answer) trues else falses
        if (pile.isEmpty()) break
        order.add(pile.removeAt(0))
        run = if (answer == last) run + 1 else 1
        last = answer
    }
    return order.toList()
}

// The run limit is DEAL.maxRun, unless no order of these answers after the cards before them can keep it;
// then it is the smallest limit some order can keep.
internal fun runLimit(trues: Int, falses: Int, join: Join): Int {
    var limit = DEAL.maxRun
    while (!placementCheck(limit)(trues, falses, join.last, join.run)) limit += 1
    return limit
}

// canPlace(t, f, last, run): can t True and f False cards still be placed after a run of `run` cards
// with answer `last`, without any run passing the limit? Memoised, so a whole deal costs little.
internal fun placementCheck(limit: Int): (Int, Int, Boolean?, Int) -> Boolean {
    val memo = HashMap<String, Boolean>()
    fun canPlace(t: Int, f: Int, last: Boolean?, run: Int): Boolean {
        if (t == 0 && f == 0) return true
        val key = "$t,$f,$last,$run"
        val known = memo[key]
        if (known != null) return known
        val result =
            (t > 0 && (last != true || run < limit) && canPlace(t - 1, f, true, if (last == true) run + 1 else 1)) ||
                (f > 0 && (last != false || run < limit) && canPlace(t, f - 1, false, if (last == false) run + 1 else 1))
        memo[key] = result
        return result
    }
    return { t, f, last, run -> canPlace(t, f, last, run) }
}

// Chooses between the allowed answers in proportion to the cards left of each.
// The run limit always leaves at least one allowed answer; the empty case is only a guard.
internal fun pickAnswer(allowed: List<Boolean>, trues: Int, falses: Int, rng: Rng): Boolean {
    if (allowed.isEmpty()) return trues > 0
    if (allowed.size == 1) return allowed[0]
    return rng() * (trues + falses).toDouble() < trues.toDouble()
}

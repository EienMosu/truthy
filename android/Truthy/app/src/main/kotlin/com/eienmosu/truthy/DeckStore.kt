package com.eienmosu.truthy

import android.content.res.AssetManager
import com.eienmosu.truthy.engine.DeckFile
import com.eienmosu.truthy.engine.DeckIndex
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.DeserializationStrategy
import kotlinx.serialization.json.Json
import java.io.IOException
import java.io.InputStream

// A deck file or the index could not be read or decoded. The round's loading screen shows its own copy.
class DeckLoadError(message: String, cause: Throwable? = null) : Exception(message, cause)

// The embedded decks (spec D3): native-data/decks is an assets source directory, so index.json and the deck
// files sit at the root of the assets. The index is decoded once, at launch; a deck is decoded off the main
// thread when a route is chosen, and the last one is kept for Play again.
class DeckStore internal constructor(
    private val open: (String) -> InputStream,
    private val io: CoroutineDispatcher = Dispatchers.IO,
) {
    constructor(assets: AssetManager) : this(open = { name: String -> assets.open(name) })

    private val decodedIndex: DeckIndex by lazy { decode(INDEX_ASSET, DeckIndex.serializer()) }

    @Volatile
    private var lastDeck: DeckFile? = null

    fun index(): DeckIndex = decodedIndex

    suspend fun deck(id: String): DeckFile {
        val kept = lastDeck
        if (kept != null && kept.id == id) return kept
        val file = withContext(io) { decode(deckAsset(id), DeckFile.serializer()) }
        if (file.id != id) throw DeckLoadError("${deckAsset(id)} holds the deck \"${file.id}\".")
        lastDeck = file
        return file
    }

    private fun <T> decode(name: String, strategy: DeserializationStrategy<T>): T {
        val text = try {
            open(name).use { stream -> stream.readBytes().toString(Charsets.UTF_8) }
        } catch (e: IOException) {
            throw DeckLoadError("Could not read $name.", e)
        }
        return try {
            DECK_JSON.decodeFromString(strategy, text)
        } catch (e: IllegalArgumentException) {
            // SerializationException is an IllegalArgumentException.
            throw DeckLoadError("$name is not a valid deck file.", e)
        }
    }

    companion object {
        const val INDEX_ASSET = "index.json"

        fun deckAsset(id: String): String = "$id.json"

        private val DECK_JSON = Json { ignoreUnknownKeys = true }
    }
}

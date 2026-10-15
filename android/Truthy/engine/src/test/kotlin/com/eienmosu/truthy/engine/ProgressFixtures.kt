package com.eienmosu.truthy.engine

import kotlinx.serialization.json.Json

// Cards for the progress unit tests, in the web's JSON shape.
object ProgressFixtures {
  fun card(id: String): Card = Json.decodeFromString(
    Card.serializer(),
    """{"id":"$id","section":"SEC","text":{"en":{"statement":"Statement $id","explanation":"Explanation $id"}},""" +
      """"answer":true,"source":{"title":"AWS docs","url":"https://docs.aws.amazon.com/"},"difficulty":1,"appliesTo":"","conflictGroups":[]}""",
  )
}

// Prints the colour of one pixel in every frame of a simulator recording, 60 frames a second, one JSON array
// [r, g, b] per line, in sRGB. Feel item N10 reads it (record.mjs).
// Usage: swift ios/Tools/visual-review/frames.swift <video> <x pixels> <y pixels>
import AVFoundation
import CoreGraphics
import Foundation

let arguments = CommandLine.arguments
guard arguments.count == 4, let x = Int(arguments[2]), let y = Int(arguments[3]) else {
    FileHandle.standardError.write(Data("usage: swift frames.swift <video> <x pixels> <y pixels>\n".utf8))
    exit(2)
}

let asset = AVURLAsset(url: URL(fileURLWithPath: arguments[1]))
let generator = AVAssetImageGenerator(asset: asset)
generator.requestedTimeToleranceBefore = .zero
generator.requestedTimeToleranceAfter = .zero
generator.appliesPreferredTrackTransform = true
guard let space = CGColorSpace(name: CGColorSpace.sRGB) else { exit(1) }

let duration = try await asset.load(.duration)
let step = CMTime(value: 1, timescale: 60)
var time = CMTime.zero
while time < duration {
    let image = try await generator.image(at: time).image
    var pixel: [UInt8] = [0, 0, 0, 0]
    pixel.withUnsafeMutableBytes { bytes in
        guard let context = CGContext(
            data: bytes.baseAddress, width: 1, height: 1, bitsPerComponent: 8, bytesPerRow: 4, space: space,
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else { return }
        // Core Graphics counts rows from the bottom: row y from the top lands on the context's only row.
        context.draw(image, in: CGRect(x: -x, y: y - image.height + 1, width: image.width, height: image.height))
    }
    print("[\(pixel[0]),\(pixel[1]),\(pixel[2])]")
    time = CMTimeAdd(time, step)
}

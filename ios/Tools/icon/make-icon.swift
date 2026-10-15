import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

// Draws the app icon: the app/icon.svg mark (44 by 30 ticket, tear line, check) at 60 percent of the width,
// centred on an opaque square in day sky-1 (#a9d6f0), as public/icon-512.png is composed (spec 5.6).
//   swift ios/Tools/icon/make-icon.swift <output.png> [size]
let arguments = CommandLine.arguments
guard arguments.count >= 2 else { fatalError("usage: make-icon.swift <output.png> [size]") }
let size = arguments.count > 2 ? Int(arguments[2]) ?? 1024 : 1024

func colour(_ hex: UInt32) -> CGColor {
    CGColor(srgbRed: CGFloat((hex >> 16) & 0xff) / 255, green: CGFloat((hex >> 8) & 0xff) / 255, blue: CGFloat(hex & 0xff) / 255, alpha: 1)
}

let space = CGColorSpace(name: CGColorSpace.sRGB)!
let context = CGContext(data: nil, width: size, height: size, bitsPerComponent: 8, bytesPerRow: 0, space: space,
                        bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
let side = CGFloat(size)
context.setFillColor(colour(0xa9d6f0))
context.fill(CGRect(x: 0, y: 0, width: side, height: side))

// SVG user space: y down, the ticket 44 wide, its width 60 percent of the icon, centred.
let scale = side * 0.6 / 44
context.translateBy(x: 0, y: side)
context.scaleBy(x: 1, y: -1)
context.translateBy(x: (side - 44 * scale) / 2, y: (side - 30 * scale) / 2)
context.scaleBy(x: scale, y: scale)

// M6 0H38A6 6 0 0 1 44 6V10.5A4.5 4.5 0 0 0 44 19.5V24A6 6 0 0 1 38 30H6A6 6 0 0 1 0 24V19.5A4.5 4.5 0 0 0 0 10.5V6A6 6 0 0 1 6 0Z
let ticket = CGMutablePath()
ticket.move(to: CGPoint(x: 6, y: 0))
ticket.addLine(to: CGPoint(x: 38, y: 0))
ticket.addArc(tangent1End: CGPoint(x: 44, y: 0), tangent2End: CGPoint(x: 44, y: 6), radius: 6)
ticket.addLine(to: CGPoint(x: 44, y: 10.5))
ticket.addArc(center: CGPoint(x: 44, y: 15), radius: 4.5, startAngle: -.pi / 2, endAngle: .pi / 2, clockwise: true)
ticket.addLine(to: CGPoint(x: 44, y: 24))
ticket.addArc(tangent1End: CGPoint(x: 44, y: 30), tangent2End: CGPoint(x: 38, y: 30), radius: 6)
ticket.addLine(to: CGPoint(x: 6, y: 30))
ticket.addArc(tangent1End: CGPoint(x: 0, y: 30), tangent2End: CGPoint(x: 0, y: 24), radius: 6)
ticket.addLine(to: CGPoint(x: 0, y: 19.5))
ticket.addArc(center: CGPoint(x: 0, y: 15), radius: 4.5, startAngle: .pi / 2, endAngle: -.pi / 2, clockwise: true)
ticket.addLine(to: CGPoint(x: 0, y: 6))
ticket.addArc(tangent1End: CGPoint(x: 0, y: 0), tangent2End: CGPoint(x: 6, y: 0), radius: 6)
ticket.closeSubpath()
context.addPath(ticket)
context.setFillColor(colour(0xf5b400))
context.fillPath()

// M33 5v20, stroke 1.6, dashes 2.5 and 3, round caps; M9 15.5l4.5 4.5 9-10, stroke 3, round caps and joins.
context.setStrokeColor(colour(0x10233f))
context.setLineCap(.round)
context.setLineWidth(1.6)
context.setLineDash(phase: 0, lengths: [2.5, 3])
context.move(to: CGPoint(x: 33, y: 5))
context.addLine(to: CGPoint(x: 33, y: 25))
context.strokePath()
context.setLineDash(phase: 0, lengths: [])
context.setLineWidth(3)
context.setLineJoin(.round)
context.move(to: CGPoint(x: 9, y: 15.5))
context.addLine(to: CGPoint(x: 13.5, y: 20))
context.addLine(to: CGPoint(x: 22.5, y: 10))
context.strokePath()

let image = context.makeImage()!
let encoded = NSMutableData()
let destination = CGImageDestinationCreateWithData(encoded as CFMutableData, UTType.png.identifier as CFString, 1, nil)!
CGImageDestinationAddImage(destination, image, nil)
guard CGImageDestinationFinalize(destination) else { fatalError("could not encode the icon") }

// ImageIO adds an eXIf chunk; the repository rejects PNG files with text or EXIF chunks (spec section 8). Keep the
// image data and the colour space only: IHDR, sRGB, IDAT and IEND, each with its own CRC unchanged.
let bytes = [UInt8](encoded as Data)
var kept = Array(bytes[0..<8])
var at = 8
while at + 8 <= bytes.count {
    let length = Int(bytes[at]) << 24 | Int(bytes[at + 1]) << 16 | Int(bytes[at + 2]) << 8 | Int(bytes[at + 3])
    let type = String(decoding: bytes[(at + 4)..<(at + 8)], as: UTF8.self)
    let end = at + 12 + length
    if ["IHDR", "sRGB", "IDAT", "IEND"].contains(type) { kept += bytes[at..<end] }
    at = end
}
let url = URL(fileURLWithPath: arguments[1])
try Data(kept).write(to: url)
print("wrote \(url.lastPathComponent), \(size) by \(size)")

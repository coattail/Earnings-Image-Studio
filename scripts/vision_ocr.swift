import Foundation
import Vision
import AppKit

let arguments = CommandLine.arguments
let jsonMode = arguments.count == 3 && arguments[1] == "--json"

guard (arguments.count == 2) || jsonMode else {
  fputs("usage: vision_ocr.swift [--json] <image-path>\n", stderr)
  exit(1)
}

let imagePath = jsonMode ? arguments[2] : arguments[1]
let imageURL = URL(fileURLWithPath: imagePath)

guard let image = NSImage(contentsOf: imageURL) else {
  fputs("failed to load image\n", stderr)
  exit(1)
}

guard let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
  fputs("failed to create cgImage\n", stderr)
  exit(1)
}

let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.usesLanguageCorrection = false

let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])

do {
  try handler.perform([request])
  let observations = request.results ?? []
  let sortedObservations = observations.sorted {
    let leftMidY = $0.boundingBox.origin.y + ($0.boundingBox.size.height / 2)
    let rightMidY = $1.boundingBox.origin.y + ($1.boundingBox.size.height / 2)
    if abs(leftMidY - rightMidY) > 0.02 {
      return leftMidY > rightMidY
    }
    return $0.boundingBox.origin.x < $1.boundingBox.origin.x
  }
  if jsonMode {
    var payload: [[String: Any]] = []
    for observation in sortedObservations {
      guard let candidate = observation.topCandidates(1).first else { continue }
      let box = observation.boundingBox
      payload.append([
        "text": candidate.string,
        "x": box.origin.x,
        "y": box.origin.y,
        "width": box.size.width,
        "height": box.size.height,
      ])
    }
    let data = try JSONSerialization.data(withJSONObject: payload, options: [])
    FileHandle.standardOutput.write(data)
  } else {
    for observation in sortedObservations {
      guard let candidate = observation.topCandidates(1).first else { continue }
      print(candidate.string)
    }
  }
} catch {
  fputs("ocr error: \(error)\n", stderr)
  exit(1)
}

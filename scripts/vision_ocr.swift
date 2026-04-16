import Foundation
import Vision
import AppKit
import PDFKit

struct ParsedArguments {
  let jsonMode: Bool
  let pdfMode: Bool
  let pageNumber: Int
  let inputPath: String
}

func parseArguments(_ arguments: [String]) -> ParsedArguments? {
  var jsonMode = false
  var pdfMode = false
  var pageNumber = 1
  var positional: [String] = []
  var index = 1

  while index < arguments.count {
    let argument = arguments[index]
    switch argument {
    case "--json":
      jsonMode = true
      index += 1
    case "--pdf":
      pdfMode = true
      index += 1
    case "--page":
      guard index + 1 < arguments.count, let parsedPageNumber = Int(arguments[index + 1]) else {
        return nil
      }
      pageNumber = max(parsedPageNumber, 1)
      index += 2
    default:
      if argument.hasPrefix("--") {
        return nil
      }
      positional.append(argument)
      index += 1
    }
  }

  guard positional.count == 1 else {
    return nil
  }
  return ParsedArguments(
    jsonMode: jsonMode,
    pdfMode: pdfMode,
    pageNumber: pageNumber,
    inputPath: positional[0]
  )
}

func loadImageCGImage(from imageURL: URL) -> CGImage? {
  guard let image = NSImage(contentsOf: imageURL) else {
    return nil
  }
  return image.cgImage(forProposedRect: nil, context: nil, hints: nil)
}

func renderPDFPageCGImage(from pdfURL: URL, pageNumber: Int) -> CGImage? {
  guard let document = PDFDocument(url: pdfURL), let page = document.page(at: pageNumber - 1) else {
    return nil
  }
  let bounds = page.bounds(for: .mediaBox).standardized
  let scale: CGFloat = 3.0
  let size = NSSize(width: max(bounds.width * scale, 1), height: max(bounds.height * scale, 1))
  let thumbnail = page.thumbnail(of: size, for: .mediaBox)
  return thumbnail.cgImage(forProposedRect: nil, context: nil, hints: nil)
}

guard let parsed = parseArguments(CommandLine.arguments) else {
  fputs("usage: vision_ocr.swift [--json] [--pdf --page <n>] <path>\n", stderr)
  exit(1)
}

let inputURL = URL(fileURLWithPath: parsed.inputPath)
let cgImage = parsed.pdfMode
  ? renderPDFPageCGImage(from: inputURL, pageNumber: parsed.pageNumber)
  : loadImageCGImage(from: inputURL)

guard let cgImage else {
  let resourceKind = parsed.pdfMode ? "PDF page" : "image"
  fputs("failed to load \(resourceKind)\n", stderr)
  exit(1)
}

let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.recognitionLanguages = ["en-US"]
request.usesLanguageCorrection = true

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
  if parsed.jsonMode {
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

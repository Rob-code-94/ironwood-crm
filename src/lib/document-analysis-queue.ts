import {
  getIronwoodDb,
  idbDeleteDocumentAnalysisJob,
  idbEnqueueDocumentAnalysis,
  idbGetAllDocumentAnalysisJobs,
  type PendingDocumentAnalysisJob,
} from "@/lib/workspace/storage/ironwood-idb"

async function fileToBase64(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => {
      const s = r.result
      if (typeof s === "string") {
        const parts = s.split(",")
        resolve(parts[1] ?? s)
      } else reject(new Error("expected data URL"))
    }
    r.onerror = () => reject(r.error)
    r.readAsDataURL(file)
  })
}

export async function enqueueDocumentAnalysisJob(params: {
  file: File
  instructions: string
  model: string
}): Promise<string> {
  await getIronwoodDb()
  const id = crypto.randomUUID()
  const fileBase64 = await fileToBase64(params.file)
  const job: PendingDocumentAnalysisJob = {
    id,
    fileName: params.file.name,
    fileType: params.file.type || "application/octet-stream",
    fileBase64,
    instructions: params.instructions,
    model: params.model,
    enqueuedAt: Date.now(),
  }
  await idbEnqueueDocumentAnalysis(job)
  return id
}

export type ProcessFileResult = { extracted?: string; error?: string }

/**
 * Sends queued offline document analyses to `/api/process-file`. Invokes `onJobDone` per successful job.
 */
export async function flushDocumentAnalysisQueue(
  onJobDone: (job: PendingDocumentAnalysisJob, result: ProcessFileResult) => void
): Promise<void> {
  await getIronwoodDb()
  const jobs = await idbGetAllDocumentAnalysisJobs()
  for (const job of jobs) {
    try {
      const res = await fetch(`data:${job.fileType};base64,${job.fileBase64}`)
      const blob = await res.blob()
      const fd = new FormData()
      fd.set("file", new File([blob], job.fileName, { type: job.fileType }))
      fd.set("instructions", job.instructions)
      fd.set("model", job.model)
      const post = await fetch("/api/process-file", { method: "POST", body: fd })
      const data = (await post.json()) as ProcessFileResult
      if (post.ok && typeof data.extracted === "string") {
        await idbDeleteDocumentAnalysisJob(job.id)
        onJobDone(job, data)
      }
    } catch {
      /* keep queued for retry */
    }
  }
}

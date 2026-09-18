import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import {
  gunzipSync,
  gzipSync,
} from "node:zlib";

import type {
  ProjectRuntimeState,
} from "./project-state-types";

interface SerializedProjectState
  extends Omit<
    ProjectRuntimeState,
    "resourcesByRevision"
  > {
  resourcesByRevision: Array<
    [
      string,
      ProjectRuntimeState[
        "resourcesByRevision"
      ] extends Map<
        string,
        infer V
      >
        ? V
        : never,
    ]
  >;
}

function configuredRoot():
  string | null {
  const explicit =
    process.env.CMENG_DATA_DIR
      ?.trim();
  if (explicit) return explicit;

  const railway =
    process.env
      .RAILWAY_VOLUME_MOUNT_PATH
      ?.trim();
  if (railway) return railway;

  return null;
}

function projectKey(
  projectId: string,
): string {
  return createHash("sha256")
    .update(projectId)
    .digest("hex");
}

function serialize(
  state: ProjectRuntimeState,
): SerializedProjectState {
  return {
    ...state,
    resourcesByRevision: [
      ...state.resourcesByRevision
        .entries(),
    ],
  };
}

function deserialize(
  value: SerializedProjectState,
): ProjectRuntimeState {
  return {
    ...value,
    resourcesByRevision:
      new Map(
        value.resourcesByRevision,
      ),
  };
}

export class ProjectStatePersistence {
  private readonly root =
    configuredRoot();

  mode():
    | "railway_volume"
    | "runtime_local" {
    return this.root
      ? "railway_volume"
      : "runtime_local";
  }

  enabled(): boolean {
    return this.root !== null;
  }

  private projectsDir():
    string | null {
    if (!this.root) return null;
    const dir = join(
      this.root,
      "cmeng",
      "projects",
    );
    mkdirSync(dir, {
      recursive: true,
    });
    return dir;
  }

  private evidenceDir(
    projectId: string,
  ): string | null {
    if (!this.root) return null;
    const dir = join(
      this.root,
      "cmeng",
      "evidence",
      projectKey(projectId),
    );
    mkdirSync(dir, {
      recursive: true,
    });
    return dir;
  }

  save(
    state: ProjectRuntimeState,
  ): void {
    const dir =
      this.projectsDir();
    if (!dir) return;

    const path = join(
      dir,
      projectKey(state.projectId) +
        ".json.gz",
    );
    const temp =
      path + ".tmp";

    const payload = gzipSync(
      Buffer.from(
        JSON.stringify(
          serialize(state),
        ),
        "utf8",
      ),
      {
        level: 6,
      },
    );

    writeFileSync(
      temp,
      payload,
    );
    renameSync(temp, path);
  }

  loadAll():
    ProjectRuntimeState[] {
    const dir =
      this.projectsDir();
    if (
      !dir ||
      !existsSync(dir)
    ) {
      return [];
    }

    const projects:
      ProjectRuntimeState[] = [];

    for (
      const file of
        readdirSync(dir)
    ) {
      if (
        !file.endsWith(
          ".json.gz",
        )
      ) {
        continue;
      }

      try {
        const raw =
          gunzipSync(
            readFileSync(
              join(dir, file),
            ),
          ).toString(
            "utf8",
          );
        const parsed =
          JSON.parse(
            raw,
          ) as SerializedProjectState;
        projects.push(
          deserialize(parsed),
        );
      } catch {
        // Corrupt snapshots are ignored
        // rather than fabricating state.
      }
    }

    return projects;
  }

  storeEvidence(
    input: {
      projectId: string;
      category:
        | "schedule"
        | "boq"
        | "contract";
      bytes: Uint8Array;
      sourceHashSha256: string;
      sourceFilename:
        | string
        | null;
    },
  ): string | null {
    const dir =
      this.evidenceDir(
        input.projectId,
      );
    if (!dir) return null;

    const safeName =
      (input.sourceFilename ??
        "source")
        .replace(
          /[^A-Za-z0-9._-]+/g,
          "_",
        )
        .slice(0, 120);

    const path = join(
      dir,
      input.category +
        "__" +
        input.sourceHashSha256 +
        "__" +
        safeName,
    );

    if (!existsSync(path)) {
      writeFileSync(
        path,
        Buffer.from(
          input.bytes,
        ),
      );
    }

    return path;
  }
}

export const projectStatePersistence =
  new ProjectStatePersistence();

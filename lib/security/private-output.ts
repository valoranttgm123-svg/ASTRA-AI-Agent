import {
  existsSync,
  lstatSync,
  mkdirSync,
  realpathSync,
} from "node:fs";
import path from "node:path";

function isOutside(
  root: string,
  candidate: string,
) {
  const relative = path.relative(
    root,
    candidate,
  );
  return (
    relative.startsWith("..") ||
    path.isAbsolute(relative)
  );
}

function assertDirectoryNoSymlink(
  directory: string,
  label: string,
) {
  const stat = lstatSync(directory);
  if (stat.isSymbolicLink()) {
    throw new Error(
      `${label} must not be a symbolic link.`,
    );
  }
  if (!stat.isDirectory()) {
    throw new Error(
      `${label} must be a directory.`,
    );
  }
}

function ensurePrivateDirectory(
  privateRoot: string,
  directory: string,
) {
  const resolvedRoot = path.resolve(privateRoot);
  const resolvedDirectory =
    path.resolve(directory);

  if (
    isOutside(
      resolvedRoot,
      resolvedDirectory,
    )
  ) {
    throw new Error(
      "Private output directory must stay inside .astra/.",
    );
  }

  if (!existsSync(resolvedRoot)) {
    mkdirSync(resolvedRoot);
  }
  assertDirectoryNoSymlink(
    resolvedRoot,
    "Private .astra root",
  );

  const relative = path.relative(
    resolvedRoot,
    resolvedDirectory,
  );
  const components = relative
    .split(path.sep)
    .filter(Boolean);

  let current = resolvedRoot;
  for (const component of components) {
    current = path.join(
      current,
      component,
    );

    if (!existsSync(current)) {
      mkdirSync(current);
      continue;
    }

    assertDirectoryNoSymlink(
      current,
      "Private output directory",
    );
  }

  const realRoot = realpathSync(
    resolvedRoot,
  );
  const realDirectory = realpathSync(
    resolvedDirectory,
  );

  if (isOutside(realRoot, realDirectory)) {
    throw new Error(
      "Private output directory resolved outside .astra/.",
    );
  }

  return realDirectory;
}

export function preparePrivateAstraOutputFile(
  candidate: string,
  allowedRoot: string,
) {
  const privateRoot = path.resolve(
    ".astra",
  );
  const resolvedAllowedRoot =
    path.resolve(allowedRoot);
  const resolvedCandidate =
    path.resolve(candidate);

  if (
    isOutside(
      privateRoot,
      resolvedAllowedRoot,
    )
  ) {
    throw new Error(
      "Allowed private output root must stay inside .astra/.",
    );
  }
  if (
    isOutside(
      resolvedAllowedRoot,
      resolvedCandidate,
    )
  ) {
    throw new Error(
      "Private output file must stay inside its allowed .astra directory.",
    );
  }

  ensurePrivateDirectory(
    privateRoot,
    path.dirname(
      resolvedCandidate,
    ),
  );

  if (existsSync(resolvedCandidate)) {
    const stat = lstatSync(
      resolvedCandidate,
    );
    if (
      stat.isSymbolicLink() ||
      !stat.isFile()
    ) {
      throw new Error(
        "Private output target must be a regular file and must not be a symbolic link.",
      );
    }
  }

  return resolvedCandidate;
}

export function assertExistingPrivateAstraFile(
  candidate: string,
) {
  const privateRoot = path.resolve(
    ".astra",
  );
  const resolvedCandidate =
    path.resolve(candidate);

  if (
    isOutside(
      privateRoot,
      resolvedCandidate,
    )
  ) {
    throw new Error(
      "Private evidence input must stay inside .astra/.",
    );
  }

  if (!existsSync(privateRoot)) {
    throw new Error(
      "Private .astra root does not exist.",
    );
  }
  assertDirectoryNoSymlink(
    privateRoot,
    "Private .astra root",
  );

  const relative = path.relative(
    privateRoot,
    resolvedCandidate,
  );
  const components = relative
    .split(path.sep)
    .filter(Boolean);

  let current = privateRoot;
  for (
    let index = 0;
    index < components.length;
    index += 1
  ) {
    current = path.join(
      current,
      components[index],
    );

    if (!existsSync(current)) {
      throw new Error(
        "Private evidence input does not exist.",
      );
    }

    const stat = lstatSync(current);
    if (stat.isSymbolicLink()) {
      throw new Error(
        "Private evidence path must not contain symbolic links.",
      );
    }

    const isLast =
      index === components.length - 1;
    if (
      isLast
        ? !stat.isFile()
        : !stat.isDirectory()
    ) {
      throw new Error(
        isLast
          ? "Private evidence input must be a regular file."
          : "Private evidence parent must be a directory.",
      );
    }
  }

  const realRoot = realpathSync(
    privateRoot,
  );
  const realCandidate = realpathSync(
    resolvedCandidate,
  );

  if (
    isOutside(
      realRoot,
      realCandidate,
    )
  ) {
    throw new Error(
      "Private evidence input resolved outside .astra/.",
    );
  }

  return realCandidate;
}

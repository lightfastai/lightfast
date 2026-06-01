import { describe, expect, it } from "vitest";

import { isDuplicateKeyError } from "../utils/drizzle-results";

describe("drizzle result helpers", () => {
  it("recognizes PlanetScale duplicate-key errors wrapped by Drizzle", () => {
    const error = Object.assign(
      new Error(
        "Failed query: insert into `lightfast_namespaces` (`handle`) values (?)"
      ),
      {
        cause: Object.assign(
          new Error(
            "target: lightfast.-.primary: vttablet: rpc error: code = AlreadyExists desc = Duplicate entry 'ada-dev' for key 'lightfast_namespaces.namespaces_handle_uq' (errno 1062) (sqlstate 23000)"
          ),
          {
            body: {
              code: "UNKNOWN",
              message:
                "Duplicate entry 'ada-dev' for key 'lightfast_namespaces.namespaces_handle_uq'",
            },
            name: "DatabaseError",
          }
        ),
      }
    );

    expect(isDuplicateKeyError(error)).toBe(true);
  });
});

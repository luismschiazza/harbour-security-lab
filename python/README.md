# Independent Python validation

`connectivity.py` is a standard-library-only loopback validator. `connectivity_contracts.py` retains planning data contracts; the actual emitted JSON uses camelCase keys aligned with TypeScript results. `test_connectivity.py` provides prepared offline tests.

No Python interpreter was confirmed in the environment and none has been installed. These files have not been run or Python-compiled in this checkpoint. Do not claim validated Python behavior from Node test coverage.

After confirming an existing approved Python 3.11+ interpreter:

```sh
python -m unittest discover -s python -p "test_*.py"
python python/connectivity.py
```

The validator requires the same environment grant as the Node CLI. It only connects to numeric `127.0.0.1` on explicitly listed ports, validates at the probe boundary, and maps localhost locally without upstream DNS. It performs no discovery, retries, DBF access or third-party requests. Importing the module does not start network activity.

Output is sanitized JSON on stdout, with run/test identity, timestamps, machine alias, scope, expected/observed results, status, duration and error codes. It does not write files; capture only to a reviewed path under the laboratory. Do not overwrite earlier evidence.

Compare outcome classification and schema, not identical latencies: independent connections occur at different instants. No assumption about native Harbour locking is made.

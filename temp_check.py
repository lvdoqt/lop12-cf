import json
with open(r"D:\lop12-cf\src\content\lessons\sinh-hoc-12\sinh-12-bai-21-hoc-thuyet-tien-hoa-tong-hop-hien-dai.json", "r", encoding="utf-8") as f:
    data = json.load(f)
exs = data["lessons"][0]["content"]["exercises"]
mcq = [e for e in exs if e["type"] == "mcq"]
for e in mcq:
    print(f"{e['id']}: {e['question'][:60]}")

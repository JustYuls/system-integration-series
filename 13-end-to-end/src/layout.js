// Place the BPMN elements on a grid (lanes as rows, steps as columns) and write the diagram part of the .bpmn file.
const SIZE = { event: [40, 40], gateway: [54, 54], task: [150, 76] };
const kind = (n) => (n.type.endsWith("Event") ? "event" : n.type.endsWith("Gateway") ? "gateway" : "task");

export function layout(model) {
  // column = longest path from the start
  const level = {};
  const visit = (id, depth) => {
    if ((level[id] ?? -1) >= depth) return;
    level[id] = depth;
    for (const f of model.nodes[id].outgoing) visit(model.flows.find((x) => x.id === f).target, depth + 1);
  };
  for (const n of Object.values(model.nodes)) if (!n.incoming.length) visit(n.id, 0);

  const laneOf = Object.fromEntries(model.lanes.flatMap((l, i) => l.nodes.map((id) => [id, i])));
  const stacks = {};
  for (const n of Object.values(model.nodes)) {
    const key = `${laneOf[n.id] ?? 0}:${level[n.id]}`;
    (stacks[key] ??= []).push(n.id);
  }
  const laneRows = model.lanes.map((_, i) => Math.max(1, ...Object.entries(stacks).filter(([k]) => k.startsWith(`${i}:`)).map(([, v]) => v.length)));
  const laneTop = [];
  let y = 40;
  laneRows.forEach((rows, i) => {
    laneTop.push(y);
    y += rows * 110 + 20;
  });
  const positions = {};
  for (const [key, ids] of Object.entries(stacks)) {
    const [lane, col] = key.split(":").map(Number);
    ids.forEach((id, row) => {
      const [w, h] = SIZE[kind(model.nodes[id])];
      positions[id] = { x: 150 + col * 210 - w / 2, y: laneTop[lane] + 65 + row * 110 - h / 2, w, h };
    });
  }
  const lanes = model.lanes.map((l, i) => ({ id: l.id, name: l.name, x: 30, y: laneTop[i], w: 150 + (Math.max(...Object.values(level)) + 1) * 210, h: laneRows[i] * 110 + 20 }));
  return { positions, lanes, width: lanes[0].w + 60, height: y + 20 };
}

const center = (p) => [p.x + p.w / 2, p.y + p.h / 2];

export function diagramXml(model) {
  const { positions, lanes } = layout(model);
  const bounds = (b) => `<dc:Bounds x="${Math.round(b.x)}" y="${Math.round(b.y)}" width="${Math.round(b.w)}" height="${Math.round(b.h)}"/>`;
  const shapes = [
    ...lanes.map((l) => `      <bpmndi:BPMNShape id="shape_${l.id}" bpmnElement="${l.id}" isHorizontal="true">${bounds(l)}</bpmndi:BPMNShape>`),
    ...Object.entries(positions).map(([id, p]) => `      <bpmndi:BPMNShape id="shape_${id}" bpmnElement="${id}">${bounds(p)}</bpmndi:BPMNShape>`),
  ];
  const edges = model.flows.map((f) => {
    const a = positions[f.source], b = positions[f.target];
    const [sx, sy] = [a.x + a.w, a.y + a.h / 2];
    const [tx, ty] = [b.x, b.y + b.h / 2];
    const mx = Math.round((sx + tx) / 2);
    const points = sy === ty ? [[sx, sy], [tx, ty]] : [[sx, sy], [mx, sy], [mx, ty], [tx, ty]];
    return `      <bpmndi:BPMNEdge id="edge_${f.id}" bpmnElement="${f.id}">${points.map(([x, y]) => `<di:waypoint x="${Math.round(x)}" y="${Math.round(y)}"/>`).join("")}</bpmndi:BPMNEdge>`;
  });
  return `  <bpmndi:BPMNDiagram id="diagram">\n    <bpmndi:BPMNPlane id="plane" bpmnElement="${model.id}">\n${[...shapes, ...edges].join("\n")}\n    </bpmndi:BPMNPlane>\n  </bpmndi:BPMNDiagram>\n`;
}

// Put the diagram into the .bpmn text (replaces an old one, so running it twice changes nothing).
export function withDiagram(xml, model) {
  const bare = xml.replace(/\s*<bpmndi:BPMNDiagram[\s\S]*?<\/bpmndi:BPMNDiagram>\s*/g, "\n");
  return bare.replace("</definitions>", `${diagramXml(model)}</definitions>`);
}

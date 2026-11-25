export const instances = [
  { name: "atualveiculos", instanceId: "19b838ad-0660-4578-befa-f56aef413b3a", groupId: "120363404751100244@g.us" },
  { name: "nao é mais uma", instanceId: "3e794c89-085d-4214-9467-c30b1cf0ec72", groupId: null },
  { name: "peloi", instanceId: "bb461f34-a13c-4683-ac56-2d4d054bca7b", groupId: "120363422073730913@g.us" },
  { name: "biomundo", instanceId: "66833bd5-5362-4d09-bfdb-b8df76a10bef", groupId: "120363403768836495@g.us" },
  { name: "jotap", instanceId: "76361ba8-bce9-4706-b20a-9d95dfaa2b7d", groupId: "120363403641823441@g.us" },
  { name: "Reatti Veiculos", instanceId: "04e37204-bafd-4dab-8ae8-d80dc6a065b5", groupId: "120363403348430213@g.us" },
  { name: "AVANT PRO", instanceId: "b5ef45f2-006b-4c87-b248-1c5281ef8776", groupId: "120363408994508071@g.us" },
  { name: "HIGIENE-DISQUE | NOTIFICAÇÕES", instanceId: "c80c1b8a-f001-4e6e-a8fa-980ed37a134c", groupId: "120363406826481001@g.us" },
  { name: "19 MOTORS", instanceId: "ad179f12-09fe-445a-a065-d7a6478a647b", groupId: "120363408700822150@g.us" },
  { name: "rafaellalimastudio", instanceId: "533b92a8-de7f-483b-a70a-63d9d7d7d53d", groupId: "120363403479454312@g.us" },
  { name: "REDEEMER - FRANÇA", instanceId: "2a37c93e-05ea-4a92-abb4-ac54f0b8127a", groupId: "120363427724279758@g.us" },
  { name: "Capital Coworking", instanceId: "526a7708-5856-4998-8784-239f6193c0dc", groupId: null },
  { name: "PAULO FREITAS AUTO", instanceId: "e6091cde-cdad-4f86-a174-8b8cb9899803", groupId: "120363410463232814@g.us" },
  { name: "CARRO CERTO", instanceId: "816ee344-acc0-45e6-b680-3aedede24821", groupId: "120363431278739461@g.us" },
  { name: "ac - automoveis", instanceId: "020a6f97-9375-4a4a-a78e-57f5ae20eb2f", groupId: "120363404590960530@g.us" },
  { name: "BRAZILIAN MOTORS", instanceId: "cff1425e-61cc-42a6-9b19-a397e09691cd", groupId: "120363413843827832@g.us" },
  { name: "disparo repasse são josé", instanceId: "57ee6959-ebde-4570-803f-c95dd466752b", groupId: "120363430589404801@g.us" },
  { name: "MW VEICULOS", instanceId: "188bd41b-93e9-4d22-9550-9a871927325d", groupId: "120363412463874710@g.us" },
  { name: "Karrao Prime IA", instanceId: "2e4adcaa-2442-403a-909f-775d223ad545", groupId: "120363406623457903@g.us" },
  { name: "2JZ MULTIMARCAS", instanceId: "f13a779c-29ed-4968-8908-215f57fe9965", groupId: "120363412972719403@g.us" },
];

export function matchInstance(text) {
  const t = String(text).toLowerCase();
  const hit = instances.find(
    (i) => t.includes(i.name.toLowerCase()) || t.includes(i.instanceId)
  );
  return hit ? hit.name : null;
}

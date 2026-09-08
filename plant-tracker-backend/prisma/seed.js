require('dotenv').config();
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  // 1. 建立管理者帳號（單一使用者）
  const username = process.env.ADMIN_USERNAME || 'owner';
  const password = process.env.ADMIN_PASSWORD || 'changeme123';
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.upsert({
    where: { username },
    update: {},
    create: { username, passwordHash },
  });
  console.log(`✅ 管理者帳號：${username} / ${password}`);

  // 2. 建立種植區域
  const locationNames = ['室內', '陽台', '溫室', '頂樓', '暫放區'];
  const locations = {};
  for (const name of locationNames) {
    // eslint-disable-next-line no-await-in-loop
    locations[name] = await prisma.location.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  console.log(`✅ 建立 ${locationNames.length} 個種植區域`);

  // 2.5 建立預設堆肥箱(高溫箱／低溫箱)。這裡是唯一會建立預設箱子的地方——
  // 之後如果使用者把箱子全部刪光,畫面上就是空的,不會再自動補回來。
  const defaultBins = [
    { name: '高溫箱', type: '高溫箱' },
    { name: '低溫箱', type: '低溫箱' },
  ];
  for (const bin of defaultBins) {
    // eslint-disable-next-line no-await-in-loop
    await prisma.compostBin.upsert({
      where: { name: bin.name },
      update: {},
      create: bin,
    });
  }
  console.log(`✅ 建立 ${defaultBins.length} 個預設堆肥箱`);

  // 3. 建立測試植物（鹿角蕨 A，含完整生命歷程，方便驗收時直接對照第 13 章驗收範例）
  const existing = await prisma.plant.findFirst({ where: { code: 'P-001' } });
  if (!existing) {
    const plantA = await prisma.plant.create({
      data: {
        code: 'P-001',
        name: '鹿角蕨',
        variety: '幼角',
        category: '觀賞',
        speciesType: '原生種',
        status: '成株',
        locationId: locations['溫室'].id,
        purchasePrice: 500,
        currentPrice: 1200,
        note: '種子資料，供驗收與前端串接測試使用',
      },
    });

    await prisma.purchase.create({
      data: {
        plantId: plantA.id,
        unitPrice: 500,
        quantity: 1,
        totalPrice: 500,
        seller: 'A 花市',
        purchaseDate: new Date('2026-06-01'),
        quality: '普通',
      },
    });

    await prisma.priceHistory.createMany({
      data: [
        { plantId: plantA.id, price: 500, recordedAt: new Date('2026-06-01') },
        { plantId: plantA.id, price: 900, recordedAt: new Date('2026-08-01') },
        { plantId: plantA.id, price: 1200, recordedAt: new Date('2026-09-01') },
      ],
    });

    await prisma.movement.create({
      data: {
        plantId: plantA.id,
        fromLocationId: locations['陽台'].id,
        toLocationId: locations['溫室'].id,
        movedAt: new Date('2026-06-20'),
      },
    });

    await prisma.plantEvent.createMany({
      data: [
        { plantId: plantA.id, eventType: '買入', eventDate: new Date('2026-06-01'), content: JSON.stringify({ unitPrice: 500 }) },
        { plantId: plantA.id, eventType: '移動', eventDate: new Date('2026-06-20'), content: JSON.stringify({ to: '溫室' }) },
        { plantId: plantA.id, eventType: '市價更新', eventDate: new Date('2026-08-01'), content: JSON.stringify({ from: 500, to: 900 }) },
        { plantId: plantA.id, eventType: '市價更新', eventDate: new Date('2026-09-01'), content: JSON.stringify({ from: 900, to: 1200 }) },
      ],
    });

    // 建立 3 株子代，測試繁殖與血緣關係（對應驗收 13.5）
    for (let i = 1; i <= 3; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await prisma.plant.create({
        data: {
          code: `P-001-0${i}`,
          name: '鹿角蕨',
          category: '觀賞',
          status: '幼苗',
          parentId: plantA.id,
          locationId: locations['溫室'].id,
          purchasePrice: 0,
          currentPrice: 0,
        },
      });
    }

    await prisma.propagation.create({
      data: {
        parentPlantId: plantA.id,
        method: '分株',
        propagationDate: new Date('2026-07-01'),
        offspringCount: 3,
      },
    });

    console.log('✅ 建立測試植物「鹿角蕨 P-001」與 3 株子代，含完整購買/市價/移動/繁殖紀錄');
  } else {
    console.log('ℹ️ 測試植物已存在，略過建立');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

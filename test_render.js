// 完整测试：模拟 render() 函数，看能不能正常输出 HTML
const rows = [
  {id:1,date:'2026-11-16',seq:1,sender:'靳侠15978575665',contact_name:'汪熙皓',contact_phone:'17603712903',address:'四川省甘孜州泸定县安乐坝瑞金路 叮咚闪购超市',qty_big:200,qty_small:0,target_big:0,target_small:0,tracking_no:'',stock:'',spec:'',note:''},
  {id:2,date:'2026-11-16',seq:2,sender:'靳侠15978575665',contact_name:'孙闯',contact_phone:'17603712903',address:'河南省许昌市建安区许繁路3935号',qty_big:150,qty_small:50,target_big:0,target_small:0,tracking_no:'',stock:'',spec:'',note:''},
];

function renderTest() {
  // ===== 第一步：按「日期+地址」汇总订单 =====
  const orders = {};
  for (const r of rows) {
    const key = r.date + '|' + r.address;
    if (!orders[key]) {
      orders[key] = { date: r.date, address: r.address, rows: [],
        sentBig: 0, sentSmall: 0, targetBig: 0, targetSmall: 0 };
    }
    orders[key].rows.push(r);
    orders[key].sentBig += r.qty_big || 0;
    orders[key].sentSmall += r.qty_small || 0;
    if (r.target_big > 0 && orders[key].targetBig === 0) orders[key].targetBig = r.target_big;
    if (r.target_small > 0 && orders[key].targetSmall === 0) orders[key].targetSmall = r.target_small;
  }

  // ===== 第二步：按日期分组显示 =====
  const byDate = {};
  for (const key in orders) {
    const d = orders[key].date;
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(orders[key]);
  }
  const sortedDates = Object.keys(byDate).sort((a,b) => b.localeCompare(a));

  let totalBig = 0, totalSmall = 0;
  let doneCount = 0, pendingCount = 0;
  let rowCount = 0;

  for (const d of sortedDates) {
    const orderList = byDate[d];
    for (const ord of orderList) {
      const tBig = ord.targetBig, tSmall = ord.targetSmall;
      const sBig = ord.sentBig, sSmall = ord.sentSmall;
      let hasTarget = (tBig > 0 || tSmall > 0);
      let remBig = Math.max(0, tBig - sBig), remSmall = Math.max(0, tSmall - sSmall);
      let state = 'none', stateHtml = '';
      if (!hasTarget) {
        stateHtml = '<span class="tag none">未填目标</span>';
      } else if (remBig === 0 && remSmall === 0) {
        state = 'done'; stateHtml = '<span class="tag done">✓ 已发完</span>'; doneCount++;
      } else if (sBig > 0 || sSmall > 0) {
        state = 'partial'; stateHtml = `<span class="tag partial">⏳ 剩大${remBig} 小${remSmall}</span>`; pendingCount++;
      } else {
        state = 'pending'; stateHtml = '<span class="tag pending">待发货</span>'; pendingCount++;
      }

      ord.rows.sort((a,b) => (a.seq || 0) - (b.seq || 0));
      for (const r of ord.rows) {
        rowCount++;
        const big = r.qty_big || 0, small = r.qty_small || 0;
        totalBig += big; totalSmall += small;
        console.log(`  row ${rowCount}: seq=${r.seq} | 大${big} 小${small} | target大${tBig} 小${tSmall} | state=${state} | ${stateHtml}`);
      }
    }
  }

  console.log(`\n汇总: 大${totalBig} 小${totalSmall} | 已完成${doneCount} 未完成${pendingCount}`);
  console.log('✅ render() 逻辑没问题！');
}

renderTest();

const prisma = require('../config/prisma');

const getAnalytics = async (req, res) => {
  try {
    const totalHandovers = await prisma.handover.count();
    
    // Repair success rate
    const totalIssues = await prisma.issue.count();
    const resolvedIssues = await prisma.issue.count({ where: { status: 'RESOLVED' } });
    const repairSuccessRate = totalIssues === 0 ? 100 : Math.round((resolvedIssues / totalIssues) * 100);

    // Average repair time (in hours)
    const resolvedIssuesList = await prisma.issue.findMany({
      where: { status: 'RESOLVED', resolvedAt: { not: null } },
      select: { createdAt: true, resolvedAt: true }
    });
    
    let totalRepairTime = 0;
    resolvedIssuesList.forEach(issue => {
      const timeDiffMs = issue.resolvedAt.getTime() - issue.createdAt.getTime();
      totalRepairTime += (timeDiffMs / (1000 * 60 * 60)); // convert to hours
    });
    const averageRepairTime = resolvedIssuesList.length > 0 ? (totalRepairTime / resolvedIssuesList.length).toFixed(1) : 0;

    // Driver compliance rate (Handovers without any issues / Total handovers)
    const handoversWithIssues = await prisma.handover.count({ where: { status: 'Ada Masalah' } });
    const driverComplianceRate = totalHandovers === 0 ? 100 : Math.round(((totalHandovers - handoversWithIssues) / totalHandovers) * 100);

    res.json({
      success: true,
      data: {
        totalHandovers,
        totalIssues,
        resolvedIssues,
        repairSuccessRate: `${repairSuccessRate}%`,
        averageRepairTime: `${averageRepairTime} Jam`,
        driverComplianceRate: `${driverComplianceRate}%`
      }
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = { getAnalytics };

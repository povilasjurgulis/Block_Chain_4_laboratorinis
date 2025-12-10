// contracts/FreelanceEscrow.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract FreelanceEscrow {
    enum JobStatus {
        Created,
        Accepted,
        Submitted,
        Completed,
        Disputed,
        Cancelled
    }

    struct Job {
        address client;
        address freelancer;
        address arbitrator;

        uint256 amount;
        JobStatus status;
    }

    uint256 public nextJobId;
    mapping(uint256 => Job) public jobs;

    event JobCreated(uint256 jobId, address client, uint256 amount);
    event JobAccepted(uint256 jobId, address freelancer);
    event WorkSubmitted(uint256 jobId);
    event JobCompleted(uint256 jobId);
    event DisputeOpened(uint256 jobId);
    event DisputeResolved(uint256 jobId, uint256 clientShare, uint256 freelancerShare);
    event JobCancelled(uint256 jobId);

    modifier onlyClient(uint256 jobId) {
        require(msg.sender == jobs[jobId].client, "Not client");
        _;
    }

    modifier onlyFreelancer(uint256 jobId) {
        require(msg.sender == jobs[jobId].freelancer, "Not freelancer");
        _;
    }

    modifier onlyArbitrator(uint256 jobId) {
        require(msg.sender == jobs[jobId].arbitrator, "Not arbitrator");
        _;
    }

    modifier inStatus(uint256 jobId, JobStatus status) {
        require(jobs[jobId].status == status, "Wrong status");
        _;
    }

    // 1. Uzsakovas sukuria darba ir inesa lesas
    function createJob(address _freelancer, address _arbitrator)
        external
        payable
        returns (uint256 jobId)
    {
        require(msg.value > 0, "Amount must be > 0");
        require(_freelancer != address(0), "Invalid freelancer");
        require(_arbitrator != address(0), "Invalid arbitrator");

        jobId = nextJobId++;
        jobs[jobId] = Job({
            client: msg.sender,
            freelancer: _freelancer,
            arbitrator: _arbitrator,
            amount: msg.value,
            status: JobStatus.Created
        });

        emit JobCreated(jobId, msg.sender, msg.value);
    }

    // 2. Freelancer'is priima darba
    function acceptJob(uint256 jobId)
        external
        inStatus(jobId, JobStatus.Created)
    {
        Job storage job = jobs[jobId];
        require(msg.sender == job.freelancer, "Only assigned freelancer");

        job.status = JobStatus.Accepted;
        emit JobAccepted(jobId, msg.sender);
    }

    // 3. Freelancer'is pateikia darba
    function submitWork(uint256 jobId)
        external
        onlyFreelancer(jobId)
        inStatus(jobId, JobStatus.Accepted)
    {
        jobs[jobId].status = JobStatus.Submitted;
        emit WorkSubmitted(jobId);
    }

    // 4. Uzsakovas patvirtina darba, lesos pervedamos freelancer'iui
    function approveWork(uint256 jobId)
        external
        onlyClient(jobId)
        inStatus(jobId, JobStatus.Submitted)
    {
        Job storage job = jobs[jobId];
        job.status = JobStatus.Completed;

        (bool sent, ) = payable(job.freelancer).call{value: job.amount}("");
        require(sent, "Payment failed");

        emit JobCompleted(jobId);
    }

    // 5. Bet kuri puse gali kelti ginca po pateikimo
    function openDispute(uint256 jobId)
        external
        inStatus(jobId, JobStatus.Submitted)
    {
        Job storage job = jobs[jobId];
        require(
            msg.sender == job.client || msg.sender == job.freelancer,
            "Only client or freelancer"
        );

        job.status = JobStatus.Disputed;
        emit DisputeOpened(jobId);
    }

    // 6. Arbitras isprendzia ginca ir paskirsto lesas
    function resolveDispute(
        uint256 jobId,
        uint256 clientShare,
        uint256 freelancerShare
    ) external onlyArbitrator(jobId) inStatus(jobId, JobStatus.Disputed) {
        Job storage job = jobs[jobId];
        require(
            clientShare + freelancerShare == job.amount,
            "Shares must equal amount"
        );

        job.status = JobStatus.Completed;

        if (clientShare > 0) {
            (bool sentClient, ) = payable(job.client).call{value: clientShare}("");
            require(sentClient, "Client payment failed");
        }

        if (freelancerShare > 0) {
            (bool sentFreelancer, ) = payable(job.freelancer).call{value: freelancerShare}("");
            require(sentFreelancer, "Freelancer payment failed");
        }

        emit DisputeResolved(jobId, clientShare, freelancerShare);
    }

    // atšaukimas, kol darbas nepriimtas
    function cancelJob(uint256 jobId)
        external
        onlyClient(jobId)
        inStatus(jobId, JobStatus.Created)
    {
        Job storage job = jobs[jobId];
        job.status = JobStatus.Cancelled;

        (bool sent, ) = payable(job.client).call{value: job.amount}("");
        require(sent, "Refund failed");

        emit JobCancelled(jobId);
    }
}
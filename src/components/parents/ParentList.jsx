import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Space, Button, message, Modal, Tooltip, Tag} from 'antd';
import { EyeOutlined, DeleteOutlined,  ExclamationCircleOutlined, PlusCircleOutlined } from '@ant-design/icons';
import apiService from '../../services/api';

const { confirm } = Modal;

const ParentList = () => {
    const [parents, setParents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedParent, setSelectedParent] = useState(null);
    const [viewModalVisible, setViewModalVisible] = useState(false);

    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const navigate = useNavigate();

    // Add table change handler
    const handleTableChange = (pagination, filters, sorter) => {
        setCurrentPage(pagination.current);
        setPageSize(pagination.pageSize);
    };

     // Add useEffect to fetch data when component mounts
     useEffect(() => {
        fetchParents();
    }, []);

    const fetchParents = async () => {
        try {
            // Update the endpoint to match the backend route
            const response = await fetch('https://api.dearsirhometuition.com/api/parents/all');
            const data = await response.json();
            if (data.success) {
                setParents(data.data);
            } else {
                message.error('Failed to fetch parents: ' + data.message);
            }
        } catch (error) {
            console.error('Fetch error:', error);
            message.error('Failed to fetch parents');
        } finally {
            setLoading(false);
        }
    };

    const showDeleteConfirm = (record) => {
        confirm({
            title: 'Are you sure you want to delete this application?',
            icon: <ExclamationCircleOutlined />,
            content: `This will permanently delete ${record.parentName}'s application.`,
            okText: 'Yes, Delete',
            okType: 'danger',
            cancelText: 'No, Cancel',
            onOk() {
                return handleDelete(record._id);
            },
            onCancel() {
                // Do nothing on cancel
            },
        });
    };

    const handleDelete = async (id) => {
        try {
            await fetch(`https://api.dearsirhometuition.com/api/parents/${id}`, {
                method: 'DELETE'
            });
            message.success('Parent application deleted successfully');
            fetchParents();
        } catch (error) {
            message.error('Failed to delete parent application');
        }
    };

    const handleCreateVacancy = async (record) => {
        try {
            // Get formatted gender from parent's preferredTeacher
            const gender = record.preferredTeacher === 'any' ? 'Any' : 
                           record.preferredTeacher === 'male' ? 'Male' : 'Female';
            
            // Create vacancy data object with updated field mappings
            const vacancyData = {
                title: `Vacancy ${String(record.applicationNumber).padStart(2, '0')}`,
                subject: Array.isArray(record.subjects) ? record.subjects[0] : record.subjects,
                // Map parent form fields to vacancy form fields
                class: record.grade, // Use grade as class
                time: record.preferredTime, // Use preferredTime directly
                location: record.address, // Use address as location
                gender: record.preferredTeacher.toLowerCase(), // Ensure it's lowercase to match schema
                description: "Experienced Teacher with required qualification are requested to apply",
                // Use the salary from parent application, default to "Negotiable" if not provided
                salary: record.salary || 'Negotiable',
                status: 'open',
                parentId: record._id // Make sure this is included explicitly
            };

            console.log("Creating vacancy with parentId:", record._id);
            
            // Create the vacancy first
            const createResponse = await apiService.createVacancy(vacancyData);
            const newVacancyId = createResponse.data._id;
            
            console.log('Vacancy created with ID:', newVacancyId);

            // Then update the parent with the vacancy reference and change status to pending
            const updateResponse = await fetch(`https://api.dearsirhometuition.com/api/parents/${record._id}/link-vacancy`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    vacancyId: newVacancyId,
                    status: 'pending'
                })
            });
            
            const updateResult = await updateResponse.json();
            
            if (updateResult.success) {
                message.success('Parent application linked to vacancy');
            } else {
                message.warning('Created vacancy but failed to update parent status');
            }

            message.success('Vacancy created successfully');
            // Refresh the parent list to show updated status
            fetchParents();
            
        } catch (error) {
            console.error('Error:', error);
            message.error('Failed to create vacancy');
        }
    };


    const getStatusTag = (status, rejectedCount) => {
        const statusColors = {
            new: 'default',
            pending: 'processing',
            done: 'success',
            not_done: 'error'
        };

        const statusTexts = {
            new: 'New Application',
            pending: 'Vacancy Created',
            done: 'Teacher Assigned',
            not_done: `Failed (${rejectedCount} rejections)`
        };

        return (
            <Tag color={statusColors[status]}>
                {statusTexts[status]}
            </Tag>
        );
    };

    useEffect(() => {
        const ws = new WebSocket('wss://api.dearsirhometuition.com');

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            
            if (data.type === 'VACANCY_UPDATE' || data.type === 'PARENT_STATUS_UPDATED') {
                console.log('Received WebSocket notification:', data);
                // Refresh parent list when vacancy status or parent status changes
                fetchParents();
            }
        };

        return () => {
            ws.close();
        };
    }, []);



    const columns = [
        {
            title: 'Application No.',
            dataIndex: 'applicationNumber',
            key: 'applicationNumber',
            width: 80,
            render: (applicationNumber) => (
                <span style={{ paddingLeft: '8px' }}>
                    {applicationNumber ? String(applicationNumber).padStart(2, '0') : 'N/A'}
                </span>
            ),
            fixed: 'left',
            sorter: (a, b) => (a.applicationNumber || 0) - (b.applicationNumber || 0)
        },

        {
          title: 'Parent Name',
          dataIndex: 'parentName',
          key: 'parentName',
          sorter: (a, b) => a.parentName.localeCompare(b.parentName)
        },
        {
          title: 'Phone',  
          dataIndex: 'phone',
          key: 'phone',
          render: (phone) => (
              <a href={`tel:${phone}`}>{phone}</a>
          )
        },
        {
            title: 'Preferred Teacher',
            dataIndex: 'preferredTeacher',
            key: 'preferredTeacher',
            render: (teacher) => (
                <Tag color={teacher === 'any' ? 'default' : teacher === 'male' ? 'blue' : 'pink'}>
                    {teacher.charAt(0).toUpperCase() + teacher.slice(1)}
                </Tag>
            )
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            width: 150,
            render: (status, record) => getStatusTag(status, record.vacancyDetails?.rejectedCount || 0),
            filters: [
                { text: 'New Application', value: 'new' },
                { text: 'Vacancy Created', value: 'pending' },
                { text: 'Teacher Assigned', value: 'done' }
            ],
            onFilter: (value, record) => record.status === value
        },
        {
          title: 'Grade',
          dataIndex: 'grade',
          key: 'grade',
          render: (grade) => `Grade ${grade}`
        },
        {
            title: 'Subjects',
            dataIndex: 'subjects',
            key: 'subjects',
            render: (subjects) => {
                // Add null check for subjects
                if (!subjects || !Array.isArray(subjects)) {
                    return '-';  // or return any default value you prefer
                }
                return (
                    <span>
                        {subjects.map((subject, index) => (
                            <span key={index}>
                                {subject.charAt(0).toUpperCase() + subject.slice(1).replace(/_/g, ' ')}
                                {index < subjects.length - 1 ? ', ' : ''}
                            </span>
                        ))}
                    </span>
                );
            }
        },
        {
            title: 'Preferred Time',
            dataIndex: 'preferredTime',
            key: 'preferredTime',
            render: (time) => {
              const times = {
                morning: 'Morning (6 AM - 10 AM)',
                afternoon: 'Afternoon (2 PM - 5 PM)',
                evening: 'Evening (5 PM - 8 PM)'
              };
              return times[time] || time;
            }
        },
        {
            title: 'Salary',
            dataIndex: 'salary',
            key: 'salary',
            render: (salary) => salary || 'Not specified'
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_, record) => (
                <Space>
                    <Tooltip title="View Details">
                        <Button 
                            icon={<EyeOutlined />} 
                            onClick={() => {
                                setSelectedParent(record);
                                setViewModalVisible(true);
                            }}
                        />
                    </Tooltip>
                    <Tooltip title="Create Vacancy">
                        <Button 
                            type="primary"
                            icon={<PlusCircleOutlined />} 
                            onClick={() => handleCreateVacancy(record)}
                        />
                    </Tooltip>
                    <Button 
                        danger 
                        icon={<DeleteOutlined />} 
                        onClick={() => showDeleteConfirm(record)}
                    />
                </Space>
            )
        }
    ];


    return (
        <div className="parent-list">
            <h2>Parent Applications</h2>
            <Table 
                columns={columns} 
                dataSource={parents}
                loading={loading}
                rowKey="_id"
                className="main-table"
                onChange={handleTableChange}
                pagination={{
                    current: currentPage,
                    pageSize: pageSize,
                    pageSizeOptions: ['10', '20', '50', '100'],
                    showSizeChanger: true,
                    showQuickJumper: true,
                    showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} items`,
                    position: ['bottomRight']
                }}
                defaultSortOrder="descend"  // Added this line
                sortDirections={['descend', 'ascend']}
            />

        <Modal
        title="Parent Details"
        visible={viewModalVisible}
        onCancel={() => setViewModalVisible(false)}
        footer={null}
        >
        {selectedParent && (
            <div>
            <p><strong>Parent Name:</strong> {selectedParent.parentName}</p>
            <p><strong>Phone:</strong> {selectedParent.phone}</p>
            <p><strong>Address:</strong> {selectedParent.address}</p>
            <p><strong>Salary:</strong> {selectedParent.salary || 'Not specified'}</p>
            <p><strong>Preferred Teacher:</strong> {
                selectedParent.preferredTeacher.charAt(0).toUpperCase() + 
                selectedParent.preferredTeacher.slice(1)
            }</p>
            <p><strong>Grade:</strong> Grade {selectedParent.grade}</p>
            <p><strong>Subjects:</strong> {
                selectedParent.subjects && Array.isArray(selectedParent.subjects) 
                    ? selectedParent.subjects.map((subject, index) => (
                        <span key={index}>
                            {subject.charAt(0).toUpperCase() + subject.slice(1).replace(/_/g, ' ')}
                            {index < selectedParent.subjects.length - 1 ? ', ' : ''}
                        </span>
              ))
              : '-'}</p>
            <p><strong>Preferred Time:</strong> {
                {
                morning: 'Morning (6 AM - 10 AM)',
                afternoon: 'Afternoon (2 PM - 5 PM)',
                evening: 'Evening (5 PM - 8 PM)'
                }[selectedParent.preferredTime] || selectedParent.preferredTime
            }</p>
            <p><strong>Submission Date:</strong> {new Date(selectedParent.submissionDate).toLocaleString()}</p>
            </div>
        )}
        </Modal>
        </div>
    );
};

export default ParentList;

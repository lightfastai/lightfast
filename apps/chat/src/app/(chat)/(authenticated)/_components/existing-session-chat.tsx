"use client";

import { useSuspenseQueries, useQueryClient } from "@tanstack/react-query";
import { ChatInterface } from "../../_components/chat-interface";
import { useModelSelection } from "~/hooks/use-model-selection";
import { useTRPC } from "~/trpc/react";
import type { LightfastAppChatUIMessage } from "~/ai/lightfast-app-chat-ui-messages";
import { ArtifactViewer, useArtifact } from "~/components/artifacts";
import { Button } from "@repo/ui/components/ui/button";
import { AnimatePresence, motion } from "framer-motion";

interface ExistingSessionChatProps {
	sessionId: string;
	agentId: string;
}

/**
 * Client component that loads existing session data and renders the chat interface.
 * With prefetched data from the server, this should render instantly.
 */
export function ExistingSessionChat({
	sessionId,
	agentId,
}: ExistingSessionChatProps) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	// Model selection (authenticated users only have model selection)
	const { selectedModelId } = useModelSelection(true);

	// Get messages query options for cache updates
	const messagesQueryOptions = trpc.message.list.queryOptions({
		sessionId,
	});

	// Batch both queries together for better performance
	const [{ data: user }, { data: messages }] = useSuspenseQueries({
		queries: [
			{
				...trpc.user.getUser.queryOptions(),
				staleTime: 5 * 60 * 1000, // Cache user data for 5 minutes
				refetchOnMount: false, // Prevent blocking navigation
				refetchOnWindowFocus: false, // Don't refetch on window focus
			},
			{
				...messagesQueryOptions,
				staleTime: 30 * 1000, // Consider data fresh for 30 seconds (we update via callbacks)
				gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes for better navigation
				refetchOnWindowFocus: false, // Don't refetch on focus since we update optimistically
				refetchOnMount: false, // Don't refetch on mount to prevent blocking navigation
			},
		],
	});

	// Convert database messages to UI format
	const initialMessages: LightfastAppChatUIMessage[] = messages.map((msg) => ({
		id: msg.id,
		role: msg.role,
		parts: msg.parts,
	})) as LightfastAppChatUIMessage[];

	// No-op for existing sessions - session already exists
	const handleSessionCreation = (_firstMessage: string) => {
		// Existing sessions don't need creation
	};

	// Artifact state for demo
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
	const { artifact, metadata, setMetadata, showArtifact, hideArtifact } = useArtifact();

	// Demo function to show artifact with mock data
	const showArtifactDemo = () => {
		showArtifact({
			documentId: 'demo-artifact',
			title: 'Advanced Python Data Processing Demo',
			kind: 'code',
			content: `import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
import matplotlib.pyplot as plt
import seaborn as sns
from dataclasses import dataclass
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@dataclass
class DataPoint:
    """Represents a single data point in our dataset."""
    timestamp: datetime
    value: float
    category: str
    metadata: Dict[str, any]

class DataProcessor:
    """
    A comprehensive data processing class that handles various data operations.
    
    This class provides functionality for loading, cleaning, transforming,
    and analyzing large datasets with built-in error handling and logging.
    """
    
    def __init__(self, data_source: str = None):
        self.data_source = data_source
        self.raw_data = None
        self.processed_data = None
        self.statistics = {}
        logger.info(f"DataProcessor initialized with source: {data_source}")
    
    def load_data(self, file_path: str, file_type: str = 'csv') -> pd.DataFrame:
        """
        Load data from various file formats.
        
        Args:
            file_path (str): Path to the data file
            file_type (str): Type of file ('csv', 'json', 'parquet', 'excel')
            
        Returns:
            pd.DataFrame: Loaded data
            
        Raises:
            FileNotFoundError: If the file doesn't exist
            ValueError: If unsupported file type
        """
        try:
            if file_type.lower() == 'csv':
                data = pd.read_csv(file_path)
            elif file_type.lower() == 'json':
                data = pd.read_json(file_path)
            elif file_type.lower() == 'parquet':
                data = pd.read_parquet(file_path)
            elif file_type.lower() == 'excel':
                data = pd.read_excel(file_path)
            else:
                raise ValueError(f"Unsupported file type: {file_type}")
            
            self.raw_data = data
            logger.info(f"Successfully loaded {len(data)} rows from {file_path}")
            return data
            
        except FileNotFoundError:
            logger.error(f"File not found: {file_path}")
            raise
        except Exception as e:
            logger.error(f"Error loading data: {str(e)}")
            raise
    
    def clean_data(self, data: pd.DataFrame) -> pd.DataFrame:
        """
        Clean the dataset by handling missing values, duplicates, and outliers.
        
        Args:
            data (pd.DataFrame): Raw data to clean
            
        Returns:
            pd.DataFrame: Cleaned data
        """
        logger.info("Starting data cleaning process...")
        
        # Handle missing values
        numeric_columns = data.select_dtypes(include=[np.number]).columns
        categorical_columns = data.select_dtypes(include=['object']).columns
        
        # Fill numeric missing values with median
        for col in numeric_columns:
            if data[col].isnull().sum() > 0:
                median_value = data[col].median()
                data[col].fillna(median_value, inplace=True)
                logger.info(f"Filled {data[col].isnull().sum()} missing values in {col} with median: {median_value}")
        
        # Fill categorical missing values with mode
        for col in categorical_columns:
            if data[col].isnull().sum() > 0:
                mode_value = data[col].mode()[0] if not data[col].mode().empty else 'Unknown'
                data[col].fillna(mode_value, inplace=True)
                logger.info(f"Filled missing values in {col} with mode: {mode_value}")
        
        # Remove duplicates
        initial_rows = len(data)
        data = data.drop_duplicates()
        removed_duplicates = initial_rows - len(data)
        if removed_duplicates > 0:
            logger.info(f"Removed {removed_duplicates} duplicate rows")
        
        # Handle outliers using IQR method
        for col in numeric_columns:
            Q1 = data[col].quantile(0.25)
            Q3 = data[col].quantile(0.75)
            IQR = Q3 - Q1
            lower_bound = Q1 - 1.5 * IQR
            upper_bound = Q3 + 1.5 * IQR
            
            outliers = data[(data[col] < lower_bound) | (data[col] > upper_bound)]
            if len(outliers) > 0:
                logger.warning(f"Found {len(outliers)} outliers in column {col}")
                # Cap outliers instead of removing them
                data[col] = data[col].clip(lower=lower_bound, upper=upper_bound)
        
        logger.info(f"Data cleaning completed. Final dataset has {len(data)} rows")
        return data
    
    def transform_data(self, data: pd.DataFrame, transformations: List[str]) -> pd.DataFrame:
        """
        Apply various transformations to the data.
        
        Args:
            data (pd.DataFrame): Data to transform
            transformations (List[str]): List of transformations to apply
            
        Returns:
            pd.DataFrame: Transformed data
        """
        logger.info(f"Applying transformations: {transformations}")
        
        for transformation in transformations:
            if transformation == 'normalize':
                numeric_columns = data.select_dtypes(include=[np.number]).columns
                data[numeric_columns] = (data[numeric_columns] - data[numeric_columns].min()) / (
                    data[numeric_columns].max() - data[numeric_columns].min()
                )
                logger.info("Applied min-max normalization")
                
            elif transformation == 'standardize':
                numeric_columns = data.select_dtypes(include=[np.number]).columns
                data[numeric_columns] = (data[numeric_columns] - data[numeric_columns].mean()) / data[numeric_columns].std()
                logger.info("Applied z-score standardization")
                
            elif transformation == 'log_transform':
                numeric_columns = data.select_dtypes(include=[np.number]).columns
                for col in numeric_columns:
                    if (data[col] > 0).all():  # Only apply to positive values
                        data[f'{col}_log'] = np.log(data[col])
                        logger.info(f"Applied log transformation to {col}")
                
            elif transformation == 'encoding':
                categorical_columns = data.select_dtypes(include=['object']).columns
                for col in categorical_columns:
                    if data[col].nunique() < 10:  # One-hot encode low cardinality categories
                        dummies = pd.get_dummies(data[col], prefix=col)
                        data = pd.concat([data, dummies], axis=1)
                        data.drop(col, axis=1, inplace=True)
                        logger.info(f"Applied one-hot encoding to {col}")
                    else:  # Label encode high cardinality categories
                        data[f'{col}_encoded'] = pd.Categorical(data[col]).codes
                        logger.info(f"Applied label encoding to {col}")
        
        return data
    
    def generate_statistics(self, data: pd.DataFrame) -> Dict:
        """
        Generate comprehensive statistics for the dataset.
        
        Args:
            data (pd.DataFrame): Data to analyze
            
        Returns:
            Dict: Dictionary containing various statistics
        """
        logger.info("Generating dataset statistics...")
        
        stats = {
            'shape': data.shape,
            'memory_usage': data.memory_usage(deep=True).sum(),
            'column_types': data.dtypes.to_dict(),
            'missing_values': data.isnull().sum().to_dict(),
            'numeric_stats': {},
            'categorical_stats': {}
        }
        
        # Numeric column statistics
        numeric_columns = data.select_dtypes(include=[np.number]).columns
        for col in numeric_columns:
            stats['numeric_stats'][col] = {
                'mean': data[col].mean(),
                'median': data[col].median(),
                'std': data[col].std(),
                'min': data[col].min(),
                'max': data[col].max(),
                'skewness': data[col].skew(),
                'kurtosis': data[col].kurtosis()
            }
        
        # Categorical column statistics
        categorical_columns = data.select_dtypes(include=['object']).columns
        for col in categorical_columns:
            stats['categorical_stats'][col] = {
                'unique_count': data[col].nunique(),
                'most_common': data[col].mode().iloc[0] if not data[col].mode().empty else None,
                'value_counts': data[col].value_counts().head(5).to_dict()
            }
        
        self.statistics = stats
        logger.info("Statistics generation completed")
        return stats
    
    def create_visualizations(self, data: pd.DataFrame, output_dir: str = './plots/'):
        """
        Create various visualizations for the dataset.
        
        Args:
            data (pd.DataFrame): Data to visualize
            output_dir (str): Directory to save plots
        """
        logger.info("Creating visualizations...")
        
        # Set style
        plt.style.use('seaborn-v0_8')
        sns.set_palette("husl")
        
        numeric_columns = data.select_dtypes(include=[np.number]).columns
        
        # Distribution plots
        if len(numeric_columns) > 0:
            fig, axes = plt.subplots(2, 2, figsize=(15, 12))
            fig.suptitle('Data Distribution Analysis', fontsize=16)
            
            for i, col in enumerate(numeric_columns[:4]):
                row, col_idx = divmod(i, 2)
                sns.histplot(data[col], ax=axes[row, col_idx], kde=True)
                axes[row, col_idx].set_title(f'Distribution of {col}')
            
            plt.tight_layout()
            plt.savefig(f'{output_dir}distributions.png', dpi=300, bbox_inches='tight')
            logger.info("Distribution plots saved")
        
        # Correlation heatmap
        if len(numeric_columns) > 1:
            plt.figure(figsize=(12, 8))
            correlation_matrix = data[numeric_columns].corr()
            sns.heatmap(correlation_matrix, annot=True, cmap='coolwarm', center=0)
            plt.title('Feature Correlation Matrix')
            plt.tight_layout()
            plt.savefig(f'{output_dir}correlation_heatmap.png', dpi=300, bbox_inches='tight')
            logger.info("Correlation heatmap saved")
    
    def export_results(self, data: pd.DataFrame, file_path: str, format: str = 'csv'):
        """
        Export processed data to various formats.
        
        Args:
            data (pd.DataFrame): Data to export
            file_path (str): Output file path
            format (str): Export format ('csv', 'json', 'parquet')
        """
        try:
            if format.lower() == 'csv':
                data.to_csv(file_path, index=False)
            elif format.lower() == 'json':
                data.to_json(file_path, orient='records', indent=2)
            elif format.lower() == 'parquet':
                data.to_parquet(file_path, index=False)
            else:
                raise ValueError(f"Unsupported export format: {format}")
            
            logger.info(f"Data exported to {file_path} in {format} format")
            
        except Exception as e:
            logger.error(f"Error exporting data: {str(e)}")
            raise

def main():
    """
    Main execution function demonstrating the DataProcessor usage.
    """
    # Initialize processor
    processor = DataProcessor("sample_dataset.csv")
    
    # Sample workflow
    try:
        # Load data (this would normally load from an actual file)
        sample_data = pd.DataFrame({
            'timestamp': pd.date_range('2023-01-01', periods=1000, freq='H'),
            'value': np.random.normal(100, 15, 1000),
            'category': np.random.choice(['A', 'B', 'C', 'D'], 1000),
            'secondary_value': np.random.exponential(2, 1000)
        })
        
        # Add some missing values and outliers for demonstration
        sample_data.loc[50:60, 'value'] = np.nan
        sample_data.loc[100:105, 'category'] = np.nan
        sample_data.loc[200, 'value'] = 500  # Outlier
        
        logger.info(f"Generated sample dataset with shape: {sample_data.shape}")
        
        # Clean the data
        cleaned_data = processor.clean_data(sample_data.copy())
        
        # Transform the data
        transformations = ['normalize', 'encoding']
        transformed_data = processor.transform_data(cleaned_data.copy(), transformations)
        
        # Generate statistics
        stats = processor.generate_statistics(transformed_data)
        
        # Print some key statistics
        print("\\n" + "="*50)
        print("DATASET STATISTICS")
        print("="*50)
        print(f"Dataset shape: {stats['shape']}")
        print(f"Memory usage: {stats['memory_usage']:,} bytes")
        print(f"Missing values: {sum(stats['missing_values'].values())}")
        
        print("\\nNumeric columns statistics:")
        for col, col_stats in stats['numeric_stats'].items():
            print(f"  {col}: mean={col_stats['mean']:.2f}, std={col_stats['std']:.2f}")
        
        print("\\nCategorical columns:")
        for col, col_stats in stats['categorical_stats'].items():
            print(f"  {col}: {col_stats['unique_count']} unique values")
        
        # Create visualizations (commented out for demo)
        # processor.create_visualizations(transformed_data)
        
        # Export results (commented out for demo)
        # processor.export_results(transformed_data, 'processed_data.csv')
        
        logger.info("Data processing pipeline completed successfully!")
        
    except Exception as e:
        logger.error(f"Pipeline failed: {str(e)}")
        raise

if __name__ == "__main__":
    main()`,
			status: 'idle',
			boundingBox: {
				top: 100,
				left: 100,
				width: 300,
				height: 200,
			},
		});
	};

	return (
		<div className="flex h-screen w-full overflow-hidden">
			{/* Chat interface - animates width when artifact is visible */}
			<motion.div 
				className="min-w-0 flex-shrink-0"
				initial={false}
				animate={{ 
					width: artifact.isVisible ? "50%" : "100%" 
				}}
				transition={{ 
					type: "spring", 
					stiffness: 300, 
					damping: 30,
					duration: 0.4 
				}}
			>
				<ChatInterface
					key={`${agentId}-${sessionId}`}
					agentId={agentId}
					sessionId={sessionId}
					initialMessages={initialMessages}
					isNewSession={false}
					handleSessionCreation={handleSessionCreation}
					user={user}
					onNewUserMessage={(userMessage) => {
						// Optimistically append the user message to the cache
						queryClient.setQueryData(messagesQueryOptions.queryKey, (oldData) => {
							const currentMessages = oldData ?? [];
							// Check if message with this ID already exists
							if (currentMessages.some((msg) => msg.id === userMessage.id)) {
								return currentMessages;
							}
							return [
								...currentMessages,
								{
									id: userMessage.id,
									role: userMessage.role,
									parts: userMessage.parts,
									modelId: selectedModelId,
								},
							];
						});
					}}
					onNewAssistantMessage={(assistantMessage) => {
						// Optimistically append the assistant message to the cache
						queryClient.setQueryData(messagesQueryOptions.queryKey, (oldData) => {
							const currentMessages = oldData ?? [];
							// Check if message with this ID already exists
							if (currentMessages.some((msg) => msg.id === assistantMessage.id)) {
								return currentMessages;
							}
							return [
								...currentMessages,
								{
									id: assistantMessage.id,
									role: assistantMessage.role,
									parts: assistantMessage.parts,
									modelId: null,
								},
							];
						});

						// Trigger a background refetch to sync with database
						// This ensures eventual consistency with the persisted data
						void queryClient.invalidateQueries({
							queryKey: messagesQueryOptions.queryKey,
						});
					}}
				/>
			</motion.div>

			{/* Artifact panel - slides in from right when visible */}
			<AnimatePresence>
				{artifact.isVisible && (
					<motion.div 
						className="w-1/2 min-w-0 flex-shrink-0 relative z-50"
						initial={{ x: "100%", opacity: 0 }}
						animate={{ 
							x: 0, 
							opacity: 1 
						}}
						exit={{ 
							x: "100%", 
							opacity: 0 
						}}
						transition={{ 
							type: "spring", 
							stiffness: 300, 
							damping: 30,
							duration: 0.4 
						}}
					>
						<ArtifactViewer
							artifact={artifact}
							// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
							metadata={metadata}
							setMetadata={setMetadata}
							onClose={hideArtifact}
							onSaveContent={(content) => {
								// For demo purposes, just log the content
								console.log('Artifact content updated:', content);
							}}
						/>
					</motion.div>
				)}
			</AnimatePresence>

			{/* Demo button when no artifact is shown */}
			{!artifact.isVisible && (
				<div className="fixed bottom-4 right-4">
					<Button 
						onClick={showArtifactDemo}
						className="z-50"
					>
						🧪 Show Artifact Demo
					</Button>
				</div>
			)}
		</div>
	);
}
